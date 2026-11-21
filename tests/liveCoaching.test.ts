import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseSavedProviderReport } from '../src/coaching/savedProviderReport.ts';
import { LIVE_ELIGIBLE_SESSIONS } from '../src/coaching/liveEligibleSessions.ts';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';
import { COST_CEILING_USD, createLiveCoachHandler, LIVE_ENDPOINT, LIVE_MODEL, type LiveCoachDeps } from '../server/liveCoaching.ts';
import { LIVE_REPORT_SCHEMA, LIVE_SESSIONS } from '../server/liveCoachingData.ts';
import { renderLiveCoachingData } from '../scripts/liveCoachingData.ts';

const repo = (path: string) => new URL(`../${path}`, import.meta.url);
const runA = '7008865c2a6439e82bf1cf60d8acbfcbaf4d1224fe3922e800b512d4f467ad14';
const fixtureKey = 'fixture-credential-never-an-account-key';
const saved = JSON.parse(readFileSync(repo('data/f1tenth-silverstone/run-a-nebius-report.json'), 'utf8')) as { reportJson: string };
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

const providerResponse = (overrides: Record<string, unknown> = {}) => ({
  id: 'chatcmpl-live-fixture', model: LIVE_MODEL,
  choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: saved.reportJson } }],
  usage: { prompt_tokens: 1362, completion_tokens: 594, total_tokens: 1956, completion_tokens_details: { reasoning_tokens: 410 } },
  ...overrides,
});
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const setup = (overrides: Partial<LiveCoachDeps> & { envs?: Record<string, string>; provider?: () => Response } = {}) => {
  const sent: { url: string; init: RequestInit }[] = [];
  let reservations = 0;
  const envs: Record<string, string> = { LIVE_COACHING_ENABLED: 'true', NEBIUS_API_KEY: fixtureKey, ...overrides.envs };
  const handler = createLiveCoachHandler({
    env: (name) => envs[name],
    sessions: LIVE_SESSIONS,
    schema: LIVE_REPORT_SCHEMA,
    reserveSlot: async () => { reservations++; return true; },
    fetcher: async (url, init) => { sent.push({ url, init }); return overrides.provider ? overrides.provider() : jsonResponse(providerResponse()); },
    now: () => new Date('2026-10-28T20:00:00Z'),
    ...overrides,
  });
  return { handler, sent, reservations: () => reservations };
};
const post = (body: unknown, headers: Record<string, string> = { 'content-type': 'application/json' }) =>
  new Request('https://blurr.example/api/live-coach', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) });
const errorOf = async (response: Response) => ((await response.json()) as { error: string }).error;

test('a live call for a bundled session returns a report the browser validator accepts', async () => {
  const { handler, sent, reservations } = setup();
  const response = await handler(post({ sessionSha256: runA }));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json() as { report: Record<string, unknown>; live: Record<string, unknown> };
  assert.equal(reservations(), 1);
  assert.equal(sent.length, 1);
  const [{ url, init }] = sent;
  assert.equal(url, LIVE_ENDPOINT);
  assert.equal((init.headers as Record<string, string>).Authorization, `Bearer ${fixtureKey}`);
  assert.equal(init.redirect, 'error');
  const outbound = JSON.parse(init.body as string) as Record<string, unknown>;
  assert.equal(outbound.model, LIVE_MODEL);
  assert.equal(outbound.max_tokens, 1024);
  assert.equal(outbound.max_completion_tokens, 1024);
  assert.equal(outbound.n, 1);
  assert.equal(outbound.store, false);
  // The pinned hash is of the body actually sent, after the output bounds were added.
  assert.equal(body.live.requestSha256, sha(init.body as string));
  assert.equal(body.live.requestSha256, LIVE_SESSIONS[runA].requestSha256);
  assert.equal(body.live.costCeilingUsd, COST_CEILING_USD);
  assert.equal(body.live.dailyCap, 60);
  const raw = new Uint8Array(readFileSync(repo('data/f1tenth-silverstone/run-a-session.json')));
  const session = await importSealedSessionFile({ name: 'run-a-session.json', size: raw.length, arrayBuffer: async () => raw.buffer });
  const validated = parseSavedProviderReport(JSON.stringify(body.report), session);
  assert.equal(validated.saved.responseId, 'chatcmpl-live-fixture');
  assert.deepEqual(validated.saved.usage, { inputTokens: 1362, outputTokens: 594, reasoningTokens: 410, totalTokens: 1956 });
  assert.ok(!JSON.stringify(body).includes(fixtureKey));
});

test('requests are refused before any reservation or provider call', async () => {
  const cases: [Request, number, string][] = [
    [new Request('https://blurr.example/api/live-coach'), 405, 'METHOD_NOT_ALLOWED'],
    [post({ sessionSha256: runA }, { 'content-type': 'text/plain' }), 415, 'JSON_REQUIRED'],
    [post(JSON.stringify({ sessionSha256: runA, pad: 'x'.repeat(2000) })), 413, 'REQUEST_TOO_LARGE'],
    [post('not json'), 400, 'REQUEST_INVALID'],
    [post({ sessionSha256: runA, extra: 1 }), 400, 'REQUEST_INVALID'],
    [post({ sessionSha256: 'A'.repeat(64) }), 400, 'REQUEST_INVALID'],
    [post({ sessionSha256: '0'.repeat(64) }), 404, 'SESSION_NOT_LIVE_ELIGIBLE'],
    [post({ sessionSha256: '__proto__'.padEnd(64, '0') }), 400, 'REQUEST_INVALID'],
  ];
  for (const [request, status, code] of cases) {
    const { handler, sent, reservations } = setup();
    const response = await handler(request);
    assert.equal(response.status, status, code);
    assert.equal(await errorOf(response), code);
    assert.equal(sent.length, 0);
    assert.equal(reservations(), 0);
  }
});

test('the kill switch, a missing key and an invalid cap fail closed', async () => {
  const cases: [Record<string, string>, string][] = [
    [{ LIVE_COACHING_ENABLED: 'false' }, 'LIVE_COACHING_DISABLED'],
    [{ LIVE_COACHING_ENABLED: '' }, 'LIVE_COACHING_DISABLED'],
    [{ NEBIUS_API_KEY: '' }, 'LIVE_COACHING_UNCONFIGURED'],
    [{ NEBIUS_API_KEY: 'bad key\nwith newline' }, 'LIVE_COACHING_UNCONFIGURED'],
    [{ LIVE_COACHING_DAILY_CAP: '61' }, 'LIVE_COACHING_UNCONFIGURED'],
    [{ LIVE_COACHING_DAILY_CAP: '0' }, 'LIVE_COACHING_UNCONFIGURED'],
    [{ LIVE_COACHING_DAILY_CAP: 'ten' }, 'LIVE_COACHING_UNCONFIGURED'],
  ];
  for (const [envs, code] of cases) {
    const { handler, sent, reservations } = setup({ envs });
    const response = await handler(post({ sessionSha256: runA }));
    assert.equal(response.status, 503, code);
    assert.equal(await errorOf(response), code);
    assert.equal(sent.length + reservations(), 0);
  }
});

test('the environment can lower the daily cap but the handler passes it to the reservation', async () => {
  let seen: [string, number] | null = null;
  const { handler } = setup({ envs: { LIVE_COACHING_DAILY_CAP: '7' }, reserveSlot: async (date, cap) => { seen = [date, cap]; return true; } });
  assert.equal((await handler(post({ sessionSha256: runA }))).status, 200);
  assert.deepEqual(seen, ['2026-10-28', 7]);
});

test('an exhausted cap or an unavailable cap store sends nothing', async () => {
  const exhausted = setup({ reserveSlot: async () => false });
  let response = await exhausted.handler(post({ sessionSha256: runA }));
  assert.equal(response.status, 429);
  assert.equal(await errorOf(response), 'DAILY_CAP_REACHED');
  assert.equal(exhausted.sent.length, 0);
  const broken = setup({ reserveSlot: async () => { throw new Error('blobs down'); } });
  response = await broken.handler(post({ sessionSha256: runA }));
  assert.equal(response.status, 503);
  assert.equal(await errorOf(response), 'CAP_STORE_UNAVAILABLE');
  assert.equal(broken.sent.length, 0);
});

test('a session whose rendered body no longer matches its pin is refused before reserving', async () => {
  const tampered = { ...LIVE_SESSIONS, [runA]: { ...LIVE_SESSIONS[runA], requestSha256: '0'.repeat(64) } };
  const { handler, sent, reservations } = setup({ sessions: tampered });
  const response = await handler(post({ sessionSha256: runA }));
  assert.equal(response.status, 500);
  assert.equal(await errorOf(response), 'LIVE_REQUEST_NOT_PINNED');
  assert.equal(sent.length + reservations(), 0);
  const unproven = { ...LIVE_SESSIONS, [runA]: { ...LIVE_SESSIONS[runA], renderedPromptBytes: 16_001 } };
  assert.equal((await setup({ sessions: unproven }).handler(post({ sessionSha256: runA }))).status, 500);
});

test('provider failures return fixed codes and never echo provider text or the key', async () => {
  const cases: [() => Response, string][] = [
    [() => new Response(`upstream said ${fixtureKey} secret-detail`, { status: 500, headers: { 'content-type': 'text/plain' } }), 'PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN'],
    [() => jsonResponse(providerResponse({ model: 'nvidia/other-model' })), 'PROVIDER_MODEL_MISMATCH'],
    [() => jsonResponse(providerResponse({ choices: [{ finish_reason: 'length', message: { content: saved.reportJson } }] })), 'PROVIDER_OUTPUT_INCOMPLETE'],
    [() => jsonResponse(providerResponse({ choices: [{ finish_reason: 'stop', message: { content: 'secret-detail not json' } }] })), 'PROVIDER_REPORT_NOT_JSON'],
    [() => jsonResponse(providerResponse({ choices: [{ finish_reason: 'stop', message: { content: '{"contract_version":"coaching-report.v1","claims":[],"interpretations":[],"drill_id":"made_up"}' } }] })), 'PROVIDER_REPORT_REJECTED'],
    [() => jsonResponse(providerResponse({ usage: { prompt_tokens: 16_001, completion_tokens: 10, total_tokens: 16_011 } })), 'PROVIDER_USAGE_INVALID'],
    [() => jsonResponse(providerResponse({ usage: undefined })), 'PROVIDER_USAGE_INVALID'],
    [() => jsonResponse(providerResponse({ id: `echo-${fixtureKey}` })), 'PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN'],
  ];
  for (const [provider, code] of cases) {
    const { handler, sent } = setup({ provider });
    const response = await handler(post({ sessionSha256: runA }));
    const text = await response.text();
    assert.equal(response.status, 502, code);
    assert.equal(JSON.parse(text).error, code);
    assert.equal(sent.length, 1);
    assert.ok(!text.includes(fixtureKey) && !text.includes('secret-detail'), code);
  }
});

test('generated live data matches the bundled captures, saved evidence and client list', async () => {
  const { server, client } = await renderLiveCoachingData();
  assert.equal(readFileSync(repo('server/liveCoachingData.ts'), 'utf8'), server);
  assert.equal(readFileSync(repo('src/coaching/liveEligibleSessions.ts'), 'utf8'), client);
  assert.deepEqual([...LIVE_ELIGIBLE_SESSIONS].sort(), Object.keys(LIVE_SESSIONS).sort());
  assert.equal(LIVE_ELIGIBLE_SESSIONS.length, 7);
  assert.deepEqual(LIVE_REPORT_SCHEMA, JSON.parse(readFileSync(repo('schemas/coaching-report.v1.schema.json'), 'utf8')));
  for (const live of Object.values(LIVE_SESSIONS)) {
    assert.ok(live.requestBytes <= 15_000 && live.renderedPromptBytes <= 16_000 && live.observedPromptTokens <= 16_000);
  }
  assert.equal(COST_CEILING_USD, 0.0057216);
});
