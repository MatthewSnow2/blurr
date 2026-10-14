/** Local Response fixture only. No fetch, environment key, model, or API call. */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';
import { buildSealedEvidenceBundle } from '../src/coaching/sessionEvidence.ts';
import { prepareNebiusAdapter } from './nebiusAdapter.ts';
import { createBoundedNebiusExchange } from './nebiusHttpExchange.ts';
import { FileAttemptJournal } from './attemptJournal.ts';

const [input, journalDirectory] = process.argv.slice(2);
if (!input || !journalDirectory) throw new Error('Provide synthetic sealed JSON path and a fresh attempt-journal directory');
const raw = new Uint8Array(readFileSync(input));
const session = await importSealedSessionFile({ name: basename(input), size: raw.length, arrayBuffer: async () => raw.buffer });
const schema = JSON.parse(readFileSync(new URL('../schemas/coaching-report.v1.schema.json', import.meta.url), 'utf8'));
const model = 'nvidia/synthetic-offline-fixture';
const evidenceId = session.source === 'f1tenth' ? 'mean_abs_lateral_deviation_m' : 'sample_count';
const http = createBoundedNebiusExchange({ attempts: new FileAttemptJournal(journalDirectory),
  credential: () => 'fixture-only-not-an-api-credential',
  fetcher: async () => new Response(JSON.stringify({ id: 'http-fixture-not-a-provider-call', model,
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ contract_version: 'coaching-report.v1',
      claims: [{ id: 'primary', type: 'metric_value', evidence_id: evidenceId }],
      interpretations: [{ template_id: 'review_claim_in_drill', slot_bindings: { claim: 'primary', drill: 'steady_line' } }], drill_id: 'steady_line' }) } }] }),
  { headers: { 'content-type': 'application/json', 'x-request-id': 'in-memory-http-fixture' } }),
});
const adapter = prepareNebiusAdapter({ endpoint: 'https://api.tokenfactory.us-central1.nebius.com/v1/chat/completions',
  modelId: model, maxTokens: 256, evidenceKind: 'synthetic_fixture' }, http.exchange, schema);
console.log(JSON.stringify({ executionKind: 'offline_in_memory_response',
  ...await adapter.coach(buildSealedEvidenceBundle(session)), httpObservation: http.observation() }, null, 2));
