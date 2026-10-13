/** Offline demonstration: the response is a local fixture, never model inference. */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { importSealedSessionFile } from '../src/lib/sessionStore.ts';
import { buildSealedEvidenceBundle } from '../src/coaching/sessionEvidence.ts';
import { prepareNebiusAdapter } from './nebiusAdapter.ts';

const input = process.argv[2];
if (!input) throw new Error('Provide the retained synthetic sealed-session JSON path');
const raw = new Uint8Array(readFileSync(input));
const session = await importSealedSessionFile({ name: basename(input), size: raw.byteLength,
  arrayBuffer: async () => raw.buffer });
const schema = JSON.parse(readFileSync(new URL('../schemas/coaching-report.v1.schema.json', import.meta.url), 'utf8'));
const modelId = 'nvidia/synthetic-offline-fixture';
const adapter = prepareNebiusAdapter({ endpoint: 'https://api.tokenfactory.nebius.com/v1/chat/completions',
  modelId, maxTokens: 256, evidenceKind: 'synthetic_fixture' }, async () => ({
  id: 'fixture-not-a-nebius-call', model: modelId,
  choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
    contract_version: 'coaching-report.v1',
    claims: [{ id: 'count', type: 'metric_value', evidence_id: 'sample_count' }],
    interpretations: [{ template_id: 'review_claim_in_drill', slot_bindings: { claim: 'count', drill: 'steady_line' } }],
    drill_id: 'steady_line',
  }) } }],
}), schema);
console.log(JSON.stringify(await adapter.coach(buildSealedEvidenceBundle(session)), null, 2));
