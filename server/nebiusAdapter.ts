/** Server-side preparation only: no default HTTP client, credentials, or retries. */
import { requestPostSessionCoaching, type SealedEvidenceBundle } from '../src/coaching/providerBoundary.ts';
import { REPORT_CONTRACT_VERSION, TEMPLATE_CATALOGUE } from '../src/coaching/reportContract.ts';
import { sha256Portable } from '../src/lib/sha256.ts';

export interface NebiusConfiguration {
  endpoint: string;
  modelId: string;
  maxTokens: number;
  evidenceKind: 'synthetic_fixture' | 'runtime_response_unverified';
}

export interface NebiusChatRequest {
  model: string;
  max_tokens: number;
  temperature: 0;
  stream: false;
  response_format: { type: 'json_object' };
  messages: { role: 'system' | 'user'; content: string }[];
}

// A future authorized server binding owns authentication, timeout/cancellation,
// response byte limits and outbound policy. The current fixtures have no I/O.
export type NebiusExchange = (endpoint: string, body: NebiusChatRequest) => Promise<unknown>;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 128 * 1024;
const hash = (value: string): string => sha256Portable(new TextEncoder().encode(value));
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROVIDER_RESPONSE_INVALID');
  return value as Record<string, unknown>;
};
const tokenCount = (value: unknown): number | null => {
  if (value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('PROVIDER_USAGE_INVALID');
  return value;
};

const configuration = (input: NebiusConfiguration): NebiusConfiguration => {
  const endpoint = new URL(input.endpoint);
  const hosts = ['api.tokenfactory.nebius.com', 'api.tokenfactory.us-central1.nebius.com'];
  if (endpoint.protocol !== 'https:' || !hosts.includes(endpoint.hostname) ||
      endpoint.pathname !== '/v1/chat/completions' || endpoint.port || endpoint.username ||
      endpoint.password || endpoint.search || endpoint.hash) throw new Error('NEBIUS_ENDPOINT_NOT_ALLOWED');
  // Namespace restriction prevents accidental non-NVIDIA substitution; it is
  // not proof of account availability, model identity/license or owner choice.
  if (!/^nvidia\/[A-Za-z0-9._-]{1,160}$/u.test(input.modelId)) throw new Error('NVIDIA_MODEL_REQUIRED');
  if (!Number.isInteger(input.maxTokens) || input.maxTokens < 1 || input.maxTokens > 2048) throw new Error('TOKEN_BOUND_INVALID');
  if (!['synthetic_fixture', 'runtime_response_unverified'].includes(input.evidenceKind)) throw new Error('EVIDENCE_KIND_INVALID');
  return { ...input, endpoint: endpoint.href };
};

export const prepareNebiusAdapter = (input: NebiusConfiguration, exchange: NebiusExchange, reportSchema: Record<string, unknown>) => {
  const config = configuration(input);
  if (reportSchema.$id !== 'https://blurr.local/schemas/coaching-report.v1.schema.json') throw new Error('REPORT_SCHEMA_REQUIRED');
  let active = false;
  return {
    async coach(bundle: SealedEvidenceBundle) {
      if (active) throw new Error('PROVIDER_REQUEST_ALREADY_ACTIVE');
      active = true;
      const providerInfo: { model: string | null; id: string | null;
        usage: { promptTokens: number | null; completionTokens: number | null; totalTokens: number | null } | null } = {
        model: null, id: null, usage: null,
      };
      let requestHash = '';
      let responseHash = '';
      const startedAt = new Date().toISOString();
      try {
        const result = await requestPostSessionCoaching(bundle, {
          async complete(request) {
            const body: NebiusChatRequest = {
              model: config.modelId, max_tokens: config.maxTokens, temperature: 0, stream: false,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: 'Return only a JSON coaching-report.v1 object. Select claims supported by the supplied evidence and reviewed templates. Never invent numbers, prose, channels, causes, or device actions. Required keys: contract_version, claims, interpretations, drill_id. Claims use the existing typed evidence contract; interpretations bind reviewed template slots. Allowed drills: steady_line, repeatable_corners, controlled_inputs.' },
                { role: 'user', content: JSON.stringify({ prompt_version: 'blurr.nebius-evidence.v1',
                  contract_version: REPORT_CONTRACT_VERSION, request, templates: TEMPLATE_CATALOGUE, report_schema: reportSchema }) },
              ],
            };
            const encoded = JSON.stringify(body);
            if (new TextEncoder().encode(encoded).length > MAX_BODY_BYTES) throw new Error('PROVIDER_REQUEST_TOO_LARGE');
            requestHash = hash(encoded);
            let response: unknown;
            try { response = await exchange(config.endpoint, body); }
            catch { throw new Error('PROVIDER_EXCHANGE_FAILED_DELIVERY_UNKNOWN'); }
            const serialized = JSON.stringify(response);
            if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).length > MAX_RESPONSE_BYTES) throw new Error('PROVIDER_RESPONSE_TOO_LARGE');
            responseHash = hash(serialized);
            const provider = object(response);
            if (provider.model !== config.modelId) throw new Error('PROVIDER_MODEL_MISMATCH');
            if (typeof provider.id !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/u.test(provider.id)) throw new Error('PROVIDER_ID_INVALID');
            if (!Array.isArray(provider.choices) || provider.choices.length !== 1) throw new Error('PROVIDER_CHOICES_INVALID');
            const choice = object(provider.choices[0]);
            const message = object(choice.message);
            if (choice.finish_reason !== 'stop' || message.refusal || typeof message.content !== 'string') throw new Error('PROVIDER_OUTPUT_INCOMPLETE');
            const reportedUsage = provider.usage === undefined ? {} : object(provider.usage);
            const usage = { promptTokens: tokenCount(reportedUsage.prompt_tokens),
              completionTokens: tokenCount(reportedUsage.completion_tokens), totalTokens: tokenCount(reportedUsage.total_tokens) };
            if (usage.completionTokens !== null && usage.completionTokens > config.maxTokens) throw new Error('PROVIDER_TOKEN_BOUND_EXCEEDED');
            if (usage.promptTokens !== null && usage.completionTokens !== null && usage.totalTokens !== null &&
                usage.totalTokens !== usage.promptTokens + usage.completionTokens) throw new Error('PROVIDER_USAGE_INVALID');
            providerInfo.model = config.modelId;
            providerInfo.id = provider.id;
            providerInfo.usage = usage;
            try { return JSON.parse(message.content); }
            catch { throw new Error('PROVIDER_REPORT_NOT_JSON'); }
          },
        });
        return {
          result,
          receipt: {
            schemaVersion: 'blurr.nebius-receipt.v1', evidenceKind: config.evidenceKind,
            sponsorRuntimeVerified: false, promptVersion: 'blurr.nebius-evidence.v1',
            endpoint: config.endpoint, requestedModel: config.modelId,
            reportedModel: providerInfo.model, providerResponseId: providerInfo.id,
            sessionId: bundle.sessionId, sessionSha256: bundle.sessionSha256,
            requestSha256: requestHash, responseSha256: responseHash,
            startedAtUtc: startedAt, completedAtUtc: new Date().toISOString(),
            usage: providerInfo.usage, validationStatus: result.status,
          },
        };
      } finally { active = false; }
    },
  };
};
