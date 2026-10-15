/** One specific approval only. Default preparation is offline and reads no key. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';
import { buildSealedEvidenceBundle } from '../src/coaching/sessionEvidence.ts';
import { prepareNebiusAdapter } from './nebiusAdapter.ts';
import { createBoundedNebiusExchange } from './nebiusHttpExchange.ts';
import { FileAttemptJournal } from './attemptJournal.ts';
import { readApprovedNebiusCredential } from './sharedCredential.ts';

const approval = 'Sentinel_966ed275be20819184341cad7ffe1d9b';
const endpoint = 'https://api.tokenfactory.nebius.com/v1/chat/completions';
const model = 'nvidia/nemotron-3-super-120b-a12b';
const [mode, output] = process.argv.slice(2);
if (!['--prepare', '--execute'].includes(mode) || !output) throw new Error('EXPLICIT_MODE_AND_OUTPUT_REQUIRED');
const directory = resolve(output);
mkdirSync(directory, { recursive: true });
const hash = (s: string) => createHash('sha256').update(s).digest('hex');
const raw = new Uint8Array(readFileSync(new URL('../fixtures/autodrive-synthetic-session.json', import.meta.url)));
const session = await importSealedSessionFile({ name: 'autodrive-synthetic-session.json', size: raw.length, arrayBuffer: async () => raw.buffer });
const schema = JSON.parse(readFileSync(new URL('../schemas/coaching-report.v1.schema.json', import.meta.url), 'utf8'));
const fixtureReport = { contract_version: 'coaching-report.v1', claims: [{ id: 'primary', type: 'metric_value', evidence_id: 'sample_count' }],
  interpretations: [{ template_id: 'review_claim_in_drill', slot_bindings: { claim: 'primary', drill: 'steady_line' } }], drill_id: 'steady_line' };
let dispatchCount = 0;
let key = '';
let safeProvider: unknown = null;
const guardPath = join(directory, approval + '.attempt.json');
if (mode === '--execute' && existsSync(guardPath)) throw new Error('APPROVAL_ALREADY_CONSUMED_DO_NOT_RETRY');
const http = createBoundedNebiusExchange({
  attempts: new FileAttemptJournal(join(directory, 'attempt-journal')),
  credential: () => key,
  fetcher: async (url, init) => {
    if (dispatchCount !== 0) throw new Error('SECOND_DISPATCH_FORBIDDEN');
    writeFileSync(guardPath, JSON.stringify({ approval, dispatchCount: 1, state: 'dispatch_start_delivery_unknown', startedAtUtc: new Date().toISOString() }), { flag: 'wx', mode: 0o600 });
    dispatchCount++;
    // Native fetch, no SDK/retry agent/fallback; redirect rejection is in init.
    return fetch(url, init);
  },
});
const adapter = prepareNebiusAdapter({ endpoint, modelId: model, maxTokens: 1024, evidenceKind: 'runtime_response_unverified' }, async (url, body) => {
  const bounded = { ...body, max_completion_tokens: 1024, n: 1, store: false, service_tier: 'default' };
  const encoded = JSON.stringify(bounded);
  if (mode === '--prepare') {
    writeFileSync(join(directory, 'request.json'), encoded + '\n');
    return { id: 'offline-preparation-not-a-provider-response', model,
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(fixtureReport) } }] };
  }
  const proof = JSON.parse(readFileSync(join(directory, 'cost-proof.json'), 'utf8'));
  if (proof.requestSha256 !== hash(encoded) || proof.maxCompletionTokens !== 1024 || proof.n !== 1 ||
      proof.maximumUsd > 0.01 || proof.maximumUsd <= 0 || proof.inputTokenUpperBound !== 16000 ||
      proof.inputUsdPerMillion !== 0.3 || proof.outputUsdPerMillion !== 0.9 ||
      proof.maximumUsd !== (16000 * 0.3 + 1024 * 0.9) / 1e6 || proof.officialPricingVerified !== true ||
      proof.publishedTemplateByteBoundVerified !== true) throw new Error('COST_PROOF_INVALID');
  // Read only after all offline checks, immediately before the one exchange.
  key = readApprovedNebiusCredential();
  const response = await http.exchange(url, bounded);
  // Persist only expected nonsensitive response fields, and reject any key echo.
  const serialized = JSON.stringify(response);
  if (serialized.includes(key)) throw new Error('RESPONSE_SECRET_ECHO_REJECTED');
  const p = response as { id?: unknown; model?: unknown; usage?: unknown; choices?: unknown };
  safeProvider = { id: p.id, model: p.model, usage: p.usage, choices: p.choices };
  return response;
}, schema);
let result: unknown = null;
let errorCode: string | null = null;
try { result = await adapter.coach(buildSealedEvidenceBundle(session)); }
catch (error) { const m = error instanceof Error ? error.message : ''; errorCode = /^[A-Z_]{1,100}$/u.test(m) ? m : 'VERIFICATION_FAILED'; }
if (mode === '--prepare') {
  if (errorCode) throw new Error(errorCode);
  console.log('OFFLINE_PREPARATION_COMPLETE_NO_CREDENTIAL_OR_DISPATCH');
} else {
  const receipt = { schemaVersion: 'blurr.approved-verification.v1', approval, completedAtUtc: new Date().toISOString(),
    dispatchCount, errorCode, result, provider: safeProvider, httpObservation: http.observation(),
    actualBilledCostUsd: null, costSource: 'provider usage times official public rates; invoice not observed',
    ownerReportedBalanceUsd: 25, sponsorRuntimeVerified: false, autoDriveLaunched: false, wheelieContacted: false };
  const encoded = JSON.stringify(receipt, null, 2);
  if (key && encoded.includes(key)) throw new Error('RECEIPT_SECRET_REJECTED');
  writeFileSync(join(directory, 'result.json'), encoded + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ dispatchCount, errorCode, httpStatus: http.observation()?.httpStatus, receipt: join(directory, 'result.json') }));
}
