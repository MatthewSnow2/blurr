import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { prepareNebiusAdapter as prepare, type NebiusConfiguration, type NebiusExchange } from '../server/nebiusAdapter.ts';
import type { SealedEvidenceBundle } from '../src/coaching/providerBoundary.ts';

const schema = JSON.parse(readFileSync(new URL('../schemas/coaching-report.v1.schema.json', import.meta.url), 'utf8'));
const prepareNebiusAdapter = (config: NebiusConfiguration, exchange: NebiusExchange) => prepare(config, exchange, schema);

const config: NebiusConfiguration = { endpoint: 'https://api.tokenfactory.nebius.com/v1/chat/completions',
  modelId: 'nvidia/synthetic-offline-fixture', maxTokens: 256, evidenceKind: 'synthetic_fixture' };
const bundle = (): SealedEvidenceBundle => ({ status: 'sealed', sessionId: 'synthetic-session',
  sessionSha256: 'a'.repeat(64), sealedAtUtc: '2026-10-13T00:00:00Z', evidence: {
    metrics: { samples: { id: 'samples', label: 'Recorded samples', unit: 'count', scope: 'session', scopeId: 'synthetic-session', value: 2 } },
    events: {}, occurrences: {}, capabilities: { collision: 'unavailable', brake: 'unavailable' },
  } });
const report = () => ({ contract_version: 'coaching-report.v1',
  claims: [{ id: 'sample-count', type: 'metric_value', evidence_id: 'samples' }],
  interpretations: [{ template_id: 'review_claim_in_drill', slot_bindings: { claim: 'sample-count', drill: 'steady_line' } }], drill_id: 'steady_line' });
const response = () => ({ id: 'fixture-not-provider-receipt', model: config.modelId,
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(report()) } }],
  usage: { prompt_tokens: 100, completion_tokens: 90, total_tokens: 190 } });

test('synthetic exchange receives bounded evidence and returns explicitly unverified receipt', async () => {
  const adapter = prepareNebiusAdapter(config, async (endpoint, body) => {
    assert.equal(endpoint, config.endpoint); assert.equal(body.model, config.modelId);
    assert.equal(body.stream, false); assert.equal(body.max_tokens, 256);
    assert.ok(body.messages[1].content.includes('synthetic-session'));
    assert.ok(!JSON.stringify(body).includes('Authorization'));
    return response();
  });
  const result = await adapter.coach(bundle());
  assert.equal(result.result.status, 'valid');
  assert.equal(result.receipt.evidenceKind, 'synthetic_fixture');
  assert.equal(result.receipt.sponsorRuntimeVerified, false);
  assert.match(result.receipt.requestSha256, /^[a-f0-9]{64}$/u);
  assert.match(result.receipt.responseSha256, /^[a-f0-9]{64}$/u);
});

test('unsealed input never reaches exchange and provider uncertainty does not cause retries', async () => {
  let calls = 0;
  const adapter = prepareNebiusAdapter(config, async () => { calls++; throw new Error('must never expose arbitrary transport text'); });
  await assert.rejects(adapter.coach({ ...bundle(), status: 'recording' } as unknown as SealedEvidenceBundle), /SESSION_NOT_SEALED/u);
  assert.equal(calls, 0);
  await assert.rejects(adapter.coach(bundle()), /PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN/u);
  assert.equal(calls, 1);
  await assert.rejects(adapter.coach(bundle()), /PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN/u);
  assert.equal(calls, 2); // Explicit caller retry, never an automatic transport retry.
});

test('wrong endpoint and non-NVIDIA substitution are rejected before exchange', () => {
  for (const endpoint of ['http://api.tokenfactory.nebius.com/v1/chat/completions',
    'https://api.tokenfactory.nebius.com.evil.example/v1/chat/completions',
    'https://api.tokenfactory.nebius.com/v1/chat/completions?key=not-a-real-key']) {
    assert.throws(() => prepareNebiusAdapter({ ...config, endpoint }, async () => response()), /ENDPOINT/u);
  }
  assert.throws(() => prepareNebiusAdapter({ ...config, modelId: 'other/model' }, async () => response()), /NVIDIA_MODEL/u);
});

test('mismatched model, truncated output, invalid JSON and oversized response fail closed', async () => {
  const variants = [
    { ...response(), model: 'other/model' },
    { ...response(), choices: [{ finish_reason: 'length', message: { content: '{}' } }] },
    { ...response(), choices: [{ finish_reason: 'stop', message: { content: '{broken' } }] },
    { ...response(), padding: 'x'.repeat(128 * 1024) },
    { ...response(), usage: { prompt_tokens: 100, completion_tokens: 90, total_tokens: 1 } },
  ];
  for (const value of variants) await assert.rejects(prepareNebiusAdapter(config, async () => value).coach(bundle()), /PROVIDER_/u);
});

test('unsupported factual claims remain invalid after API response parsing', async () => {
  const invalid = { ...report(), claims: [{ id: 'invented', type: 'metric_value', evidence_id: 'missing' }] };
  const result = await prepareNebiusAdapter(config, async () => ({ ...response(),
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(invalid) } }] })).coach(bundle());
  assert.equal(result.result.status, 'invalid');
  assert.equal(result.receipt.validationStatus, 'invalid');
});

test('single-flight blocks overlap and completion releases the slot for a later request', async () => {
  let resolve: (value: unknown) => void = () => {};
  const adapter = prepareNebiusAdapter(config, () => new Promise((r) => { resolve = r; }));
  const first = adapter.coach(bundle());
  await assert.rejects(adapter.coach(bundle()), /ALREADY_ACTIVE/u);
  resolve(response()); await first;
  const second = adapter.coach(bundle()); resolve(response());
  assert.equal((await second).result.status, 'valid');
});

test('a known local duplicate is reported as not sent rather than uncertain provider delivery', async () => {
  const adapter = prepareNebiusAdapter(config, async () => { throw new Error('DUPLICATE_ATTEMPT_BLOCKED'); });
  await assert.rejects(adapter.coach(bundle()), /DUPLICATE_ATTEMPT_BLOCKED/u);
});
