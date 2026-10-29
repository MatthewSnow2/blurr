import type { StoredSession } from '../lib/sessionStore.ts';
import { parseSavedProviderReport, type ValidatedSavedReport } from './savedProviderReport.ts';
import { LIVE_ELIGIBLE_SESSIONS } from './liveEligibleSessions.ts';

export const LIVE_COACH_PATH = '/api/live-coach';
const MAX_LIVE_RESPONSE_BYTES = 256 * 1024;

export interface LiveCallMeta { requestSha256: string; durationMs: number | null; costCeilingUsd: number; dailyCap: number }
export interface LiveCoachingResult { validated: ValidatedSavedReport; live: LiveCallMeta }

export class LiveCoachingError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}

export const isLiveEligible = (session: StoredSession): boolean => LIVE_ELIGIBLE_SESSIONS.includes(session.canonicalSha256);

type Fetcher = (url: string, init: RequestInit) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

/**
 * Asks the hosted function for one fresh Nemotron report on this session. The server's
 * answer is re-validated here against the session's own evidence before it is shown.
 */
export const requestLiveCoaching = async (session: StoredSession, fetcher: Fetcher): Promise<LiveCoachingResult> => {
  if (!isLiveEligible(session)) throw new LiveCoachingError('SESSION_NOT_LIVE_ELIGIBLE');
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetcher(LIVE_COACH_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionSha256: session.canonicalSha256 }) });
  } catch { throw new LiveCoachingError('LIVE_UNREACHABLE'); }
  const text = await response.text();
  if (new TextEncoder().encode(text).length > MAX_LIVE_RESPONSE_BYTES) throw new LiveCoachingError('LIVE_RESPONSE_INVALID');
  let body: unknown = null;
  try { body = JSON.parse(text); } catch { /* handled below */ }
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null;
  if (!response.ok) {
    const code = typeof record?.error === 'string' && /^[A-Z_]{1,100}$/u.test(record.error) ? record.error : `HTTP_${response.status}`;
    throw new LiveCoachingError(code);
  }
  if (!record || !record.report || !record.live || typeof record.live !== 'object') throw new LiveCoachingError('LIVE_RESPONSE_INVALID');
  let validated: ValidatedSavedReport;
  try { validated = parseSavedProviderReport(JSON.stringify(record.report), session); }
  catch (error) { throw new LiveCoachingError(error instanceof Error && /^[A-Z_]{1,100}$/u.test(error.message) ? error.message : 'LIVE_RESPONSE_INVALID'); }
  const live = record.live as Record<string, unknown>;
  if (typeof live.requestSha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(live.requestSha256)
    || !(live.durationMs === null || (typeof live.durationMs === 'number' && Number.isFinite(live.durationMs)))
    || typeof live.costCeilingUsd !== 'number' || typeof live.dailyCap !== 'number') throw new LiveCoachingError('LIVE_RESPONSE_INVALID');
  return { validated, live: { requestSha256: live.requestSha256, durationMs: live.durationMs as number | null,
    costCeilingUsd: live.costCeilingUsd, dailyCap: live.dailyCap } };
};

const messages: Record<string, string> = {
  DAILY_CAP_REACHED: "Today's live-call budget for this demo is used up (it resets at 00:00 UTC). The saved report above came from the same model and request.",
  HTTP_429: 'Too many live requests from this connection. Wait a minute and try again.',
  LIVE_COACHING_DISABLED: 'Live coaching is switched off on this deployment. The saved report above still works.',
  LIVE_COACHING_UNCONFIGURED: 'Live coaching is not configured on this deployment. The saved report above still works.',
  LIVE_UNREACHABLE: 'The live coaching service could not be reached. The saved report above still works.',
  HTTP_404: 'This build has no live coaching service (it needs the Netlify function). The saved report above still works.',
  CAP_STORE_UNAVAILABLE: 'The live-call budget could not be checked, so no call was made. Try again shortly.',
  REPORT_CLAIMS_UNSUPPORTED: "Nemotron's reply included claims this session's evidence cannot support, so it is not shown.",
  PROVIDER_REPORT_REJECTED: "Nemotron's reply did not pass the report contract, so it is not shown.",
  PROVIDER_OUTPUT_INCOMPLETE: "Nemotron's reply hit the 1,024-token output limit before it finished, so it is not shown. The saved report above still works.",
};
export const liveCoachingMessage = (error: unknown): string => {
  const code = error instanceof LiveCoachingError ? error.code : 'LIVE_COACHING_FAILED';
  return messages[code] ?? `The live call did not produce a usable report (${code}). The saved report above still works.`;
};
