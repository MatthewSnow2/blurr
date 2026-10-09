import assert from 'node:assert/strict';
import test from 'node:test';

import { requestPostSessionCoaching, type CoachingTransport, type SealedEvidenceBundle } from '../src/coaching/providerBoundary.ts';
import { REPORT_CONTRACT_VERSION, type EvidenceStore } from '../src/coaching/reportContract.ts';

const evidence: EvidenceStore = {
  metrics: {
    cte: {
      id: 'cte',
      label: 'Mean cross-track error',
      unit: 'm',
      scope: 'session',
      scopeId: 'session-1',
      value: 0.25,
    },
  },
  events: {},
  occurrences: {},
  capabilities: { collision: 'unavailable', brake: 'unavailable' },
};

const bundle = (): SealedEvidenceBundle => ({
  status: 'sealed',
  sessionId: 'synthetic-session-1',
  sessionSha256: 'a'.repeat(64),
  sealedAtUtc: '2026-10-09T00:00:00.000Z',
  evidence,
});

test('post-session boundary calls an injected transport only after sealing and validates its response', async () => {
  let requests = 0;
  const transport: CoachingTransport = {
    async complete(request) {
      requests += 1;
      assert.equal(request.contractVersion, REPORT_CONTRACT_VERSION);
      assert.equal(request.sessionId, 'synthetic-session-1');
      return {
        contract_version: REPORT_CONTRACT_VERSION,
        claims: [{ id: 'cte', type: 'metric_value', evidence_id: 'cte' }],
        interpretations: [{
          template_id: 'review_claim_in_drill',
          slot_bindings: { claim: 'cte', drill: 'steady_line' },
        }],
        drill_id: 'steady_line',
      };
    },
  };

  const result = await requestPostSessionCoaching(bundle(), transport);
  assert.equal(requests, 1);
  assert.equal(result.status, 'valid');
});

test('unsealed or malformed session metadata fails before transport', async () => {
  let requests = 0;
  const transport: CoachingTransport = {
    async complete() {
      requests += 1;
      return {};
    },
  };
  const unsealed = { ...bundle(), status: 'recording' } as unknown as SealedEvidenceBundle;

  await assert.rejects(() => requestPostSessionCoaching(unsealed, transport), /SESSION_NOT_SEALED/u);
  assert.equal(requests, 0);

  const invalidDigest = { ...bundle(), sessionSha256: 'not-a-digest' };
  await assert.rejects(() => requestPostSessionCoaching(invalidDigest, transport), /SESSION_DIGEST_INVALID/u);
  assert.equal(requests, 0);
});

test('schema-valid-looking unsupported provider output becomes unavailable', async () => {
  const transport: CoachingTransport = {
    async complete() {
      return {
        contract_version: REPORT_CONTRACT_VERSION,
        claims: [{ id: 'invented', type: 'trend', evidence_id: 'cte', direction: 'decreasing' }],
        interpretations: [],
        drill_id: 'steady_line',
      };
    },
  };

  const result = await requestPostSessionCoaching(bundle(), transport);
  assert.equal(result.status, 'invalid');
  if (result.status === 'invalid') assert.equal(result.issues[0].code, 'TREND_SERIES_REQUIRED');
});
