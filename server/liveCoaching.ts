/** Hosted live coaching: one bounded Token Factory call for a bundled session, behind a kill switch and a daily cap. */
import type { SealedEvidenceBundle } from '../src/coaching/providerBoundary.ts';
import type { SavedProviderReport } from '../src/coaching/savedProviderReport.ts';
import { sha256Portable } from '../src/lib/sha256.ts';
import type { AttemptStore } from './attemptJournal.ts';
import { prepareNebiusAdapter, type NebiusChatRequest } from './nebiusAdapter.ts';
import { createBoundedNebiusExchange } from './nebiusHttpExchange.ts';
import { HARD_DAILY_CAP, utcDateKey } from './liveCoachCap.ts';

export const LIVE_ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions';
export const LIVE_MODEL = 'nvidia/nemotron-3-super-120b-a12b';
export const MAX_COMPLETION_TOKENS = 1024;
// Cost bound, same basis as server/runApprovedVerification.ts: official prices read from
// https://tokenfactory.nebius.com/api/public/models_info (0.3 in / 0.9 out USD per million, 28 Oct 2026).
export const INPUT_TOKEN_UPPER_BOUND = 16_000;
export const INPUT_USD_PER_MILLION = 0.3;
export const OUTPUT_USD_PER_MILLION = 0.9;
export const COST_CEILING_USD = (INPUT_TOKEN_UPPER_BOUND * INPUT_USD_PER_MILLION + MAX_COMPLETION_TOKENS * OUTPUT_USD_PER_MILLION) / 1e6;
// Prompt tokens never exceed rendered bytes; the margin covers the chat template.
export const MAX_OUTBOUND_BODY_BYTES = 15_000;
const MAX_REQUEST_BYTES = 1024;

export interface LiveSession {
  bundle: SealedEvidenceBundle;
  requestSha256: string;
  requestBytes: number;
  // From the saved attempt that sent this exact body: prompt rendered with the published chat template
  // (at most one token per byte) and the prompt tokens Token Factory reported.
  renderedPromptBytes: number;
  observedPromptTokens: number;
}
export interface LiveMeta {
  requestSha256: string;
  responseSha256: string;
  durationMs: number | null;
  costCeilingUsd: number;
  dailyCap: number;
}
export interface LiveCoachDeps {
  env: (name: string) => string | undefined;
  sessions: Readonly<Record<string, LiveSession>>;
  schema: Record<string, unknown>;
  reserveSlot: (utcDate: string, cap: number) => Promise<boolean>;
  fetcher: (url: string, init: RequestInit) => Promise<Response>;
  now?: () => Date;
}

/** The exact body sent to Token Factory: the adapter's request plus the runner's output bounds. */
export const outboundBody = (body: NebiusChatRequest) => ({
  ...body, max_completion_tokens: MAX_COMPLETION_TOKENS, n: 1, store: false, service_tier: 'default',
});

const adapterConfig = { endpoint: LIVE_ENDPOINT, modelId: LIVE_MODEL, maxTokens: MAX_COMPLETION_TOKENS,
  evidenceKind: 'runtime_response_unverified' as const };
const hash = (text: string): string => sha256Portable(new TextEncoder().encode(text));
const offlineReport = JSON.stringify({ contract_version: 'coaching-report.v1',
  claims: [{ id: 'primary', type: 'metric_value', evidence_id: 'sample_count' }],
  interpretations: [{ template_id: 'review_claim_in_drill', slot_bindings: { claim: 'primary', drill: 'steady_line' } }],
  drill_id: 'steady_line' });

/** Renders the final outbound body offline (no credential, no network). */
export const renderLiveRequest = async (bundle: SealedEvidenceBundle, schema: Record<string, unknown>) => {
  let encoded: string | null = null;
  const adapter = prepareNebiusAdapter(adapterConfig, async (_url, body) => {
    encoded = JSON.stringify(outboundBody(body));
    return { id: 'offline-render', model: LIVE_MODEL, choices: [{ finish_reason: 'stop', message: { content: offlineReport } }] };
  }, schema);
  await adapter.coach(bundle);
  if (encoded === null) throw new Error('LIVE_REQUEST_NOT_RENDERED');
  const text: string = encoded;
  return { encoded: text, sha256: hash(text), bytes: new TextEncoder().encode(text).length };
};

class MemoryAttempts implements AttemptStore {
  private readonly keys = new Set<string>();
  reserve(requestKey: string): void {
    if (this.keys.has(requestKey)) throw new Error('DUPLICATE_ATTEMPT_BLOCKED');
    this.keys.add(requestKey);
  }
  finish(): void {}
}

class LiveError extends Error {
  readonly status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}
const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const count = (value: unknown, max: number): number => {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new LiveError(502, 'PROVIDER_USAGE_INVALID');
  return value;
};

const parseRequest = async (req: Request): Promise<string> => {
  if (req.method !== 'POST') throw new LiveError(405, 'METHOD_NOT_ALLOWED');
  if (!/^application\/json(?:;|$)/iu.test(req.headers.get('content-type') ?? '')) throw new LiveError(415, 'JSON_REQUIRED');
  const declared = req.headers.get('content-length');
  if (declared !== null && (!/^\d+$/u.test(declared) || Number(declared) > MAX_REQUEST_BYTES)) throw new LiveError(413, 'REQUEST_TOO_LARGE');
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_REQUEST_BYTES) throw new LiveError(413, 'REQUEST_TOO_LARGE');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new LiveError(400, 'REQUEST_INVALID'); }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new LiveError(400, 'REQUEST_INVALID');
  const keys = Object.keys(parsed);
  const digest = (parsed as Record<string, unknown>).sessionSha256;
  if (keys.length !== 1 || typeof digest !== 'string' || !/^[a-f0-9]{64}$/u.test(digest)) throw new LiveError(400, 'REQUEST_INVALID');
  return digest;
};

const dailyCap = (raw: string | undefined): number => {
  if (raw === undefined || raw === '') return HARD_DAILY_CAP;
  // The environment may lower the cap, never raise it past the approved maximum.
  if (!/^\d{1,3}$/u.test(raw) || Number(raw) < 1 || Number(raw) > HARD_DAILY_CAP) throw new LiveError(503, 'LIVE_COACHING_UNCONFIGURED');
  return Number(raw);
};

export const createLiveCoachHandler = (deps: LiveCoachDeps) => async (req: Request): Promise<Response> => {
  try {
    const digest = await parseRequest(req);
    if (!Object.prototype.hasOwnProperty.call(deps.sessions, digest)) throw new LiveError(404, 'SESSION_NOT_LIVE_ELIGIBLE');
    const session = deps.sessions[digest];
    if (deps.env('LIVE_COACHING_ENABLED') !== 'true') throw new LiveError(503, 'LIVE_COACHING_DISABLED');
    const key = deps.env('NEBIUS_API_KEY') ?? '';
    if (!/^[A-Za-z0-9._~+/=-]{16,4096}$/u.test(key)) throw new LiveError(503, 'LIVE_COACHING_UNCONFIGURED');
    const cap = dailyCap(deps.env('LIVE_COACHING_DAILY_CAP'));

    // Refuse before spending a slot unless the outbound body is the pinned, cost-bounded one.
    const rendered = await renderLiveRequest(session.bundle, deps.schema);
    if (rendered.sha256 !== session.requestSha256 || rendered.bytes !== session.requestBytes || rendered.bytes > MAX_OUTBOUND_BODY_BYTES ||
        session.renderedPromptBytes > INPUT_TOKEN_UPPER_BOUND) {
      throw new LiveError(500, 'LIVE_REQUEST_NOT_PINNED');
    }

    let reserved: boolean;
    try { reserved = await deps.reserveSlot(utcDateKey((deps.now ?? (() => new Date()))()), cap); }
    catch { throw new LiveError(503, 'CAP_STORE_UNAVAILABLE'); }
    if (!reserved) throw new LiveError(429, 'DAILY_CAP_REACHED');

    let dispatched = 0;
    const http = createBoundedNebiusExchange({
      attempts: new MemoryAttempts(),
      credential: () => key,
      timeoutMs: 30_000,
      fetcher: async (url, init) => {
        if (dispatched !== 0) throw new Error('SECOND_DISPATCH_FORBIDDEN');
        dispatched++;
        return deps.fetcher(url, init);
      },
    });
    let sentSha256 = '';
    let provider: { content: string; usage: Record<string, unknown> } | null = null;
    const adapter = prepareNebiusAdapter(adapterConfig, async (url, body) => {
      const bounded = outboundBody(body);
      sentSha256 = hash(JSON.stringify(bounded));
      if (sentSha256 !== session.requestSha256) throw new Error('LIVE_REQUEST_NOT_PINNED');
      const response = await http.exchange(url, bounded);
      if (JSON.stringify(response).includes(key)) throw new Error('RESPONSE_SECRET_ECHO_REJECTED');
      const p = response as { choices?: { message?: { content?: unknown } }[]; usage?: unknown };
      const content = p.choices?.[0]?.message?.content;
      const usage = p.usage && typeof p.usage === 'object' ? p.usage as Record<string, unknown> : {};
      if (typeof content === 'string') provider = { content, usage };
      return response;
    }, deps.schema);

    let outcome: Awaited<ReturnType<typeof adapter.coach>>;
    try { outcome = await adapter.coach(session.bundle); }
    catch (error) {
      const message = error instanceof Error ? error.message : '';
      throw new LiveError(502, /^[A-Z_]{1,100}$/u.test(message) ? message : 'LIVE_COACHING_FAILED');
    }
    const { result, receipt } = outcome;
    const answered = provider as { content: string; usage: Record<string, unknown> } | null;
    if (result.status !== 'valid' || !answered || !receipt.providerResponseId) throw new LiveError(502, 'PROVIDER_REPORT_REJECTED');
    const details = answered.usage.completion_tokens_details;
    const reasoning = details && typeof details === 'object' ? (details as Record<string, unknown>).reasoning_tokens : undefined;
    const usage = {
      inputTokens: count(answered.usage.prompt_tokens, INPUT_TOKEN_UPPER_BOUND),
      outputTokens: count(answered.usage.completion_tokens, MAX_COMPLETION_TOKENS),
      reasoningTokens: reasoning === undefined ? 0 : count(reasoning, MAX_COMPLETION_TOKENS),
      totalTokens: count(answered.usage.total_tokens, INPUT_TOKEN_UPPER_BOUND + MAX_COMPLETION_TOKENS),
    };
    if (usage.totalTokens !== usage.inputTokens + usage.outputTokens || usage.reasoningTokens > usage.outputTokens) {
      throw new LiveError(502, 'PROVIDER_USAGE_INVALID');
    }
    const report: SavedProviderReport = {
      schemaVersion: 'blurr.saved-provider-report.v1', sessionSha256: digest, telemetryKind: 'recorded_simulation',
      model: LIVE_MODEL, responseId: receipt.providerResponseId, completedAtUtc: receipt.completedAtUtc, usage,
      reportJson: answered.content, reportSha256: hash(answered.content),
    };
    const live: LiveMeta = { requestSha256: sentSha256, responseSha256: receipt.responseSha256,
      durationMs: http.observation()?.durationMs ?? null, costCeilingUsd: COST_CEILING_USD, dailyCap: cap };
    const body = JSON.stringify({ report, live });
    if (body.includes(key)) throw new LiveError(502, 'RESPONSE_SECRET_ECHO_REJECTED');
    return json(200, { report, live });
  } catch (error) {
    if (error instanceof LiveError) return json(error.status, { error: error.message });
    return json(500, { error: 'LIVE_COACHING_FAILED' });
  }
};
