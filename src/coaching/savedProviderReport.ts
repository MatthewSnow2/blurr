import { sha256Portable } from '../lib/sha256.ts';
import type { StorageLike, StoredSession } from '../lib/sessionStore.ts';
import { buildSessionEvidence } from './sessionEvidence.ts';
import { validateAndRenderReport, type RenderedCoachingReport } from './reportContract.ts';

export const MAX_SAVED_REPORT_BYTES = 128 * 1024;
const PREFIX = 'blurr.saved-provider-report.v1.';
export interface SavedProviderReport {
  schemaVersion: 'blurr.saved-provider-report.v1';
  sessionSha256: string;
  telemetryKind: 'synthetic_replay' | 'recorded_simulation';
  model: string;
  responseId: string;
  completedAtUtc: string;
  usage: { inputTokens: number; outputTokens: number; reasoningTokens: number; totalTokens: number };
  reportJson: string;
  reportSha256: string;
}
export interface ValidatedSavedReport { saved: SavedProviderReport; report: RenderedCoachingReport }
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('REPORT_FILE_INVALID');
  return v as Record<string, unknown>;
};
const text = (v: unknown, pattern: RegExp): string => {
  if (typeof v !== 'string' || !pattern.test(v)) throw new Error('REPORT_METADATA_INVALID');
  return v;
};
const count = (v: unknown, max: number): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0 || v > max) throw new Error('REPORT_USAGE_INVALID');
  return v;
};
/** File metadata is attributed to the imported receipt; it is not authenticated by the browser. */
export const parseSavedProviderReport = (input: string, session: StoredSession): ValidatedSavedReport => {
  if (new TextEncoder().encode(input).length > MAX_SAVED_REPORT_BYTES) throw new Error('REPORT_FILE_TOO_LARGE');
  let parsed: unknown;
  try { parsed = JSON.parse(input); } catch { throw new Error('REPORT_FILE_INVALID'); }
  const root = record(parsed);
  if (root.schemaVersion !== 'blurr.saved-provider-report.v1') throw new Error('REPORT_SCHEMA_UNSUPPORTED');
  const sessionSha256 = text(root.sessionSha256, /^[a-f0-9]{64}$/u);
  if (sessionSha256 !== session.canonicalSha256) throw new Error('REPORT_SESSION_MISMATCH');
  if (root.telemetryKind !== 'synthetic_replay' && root.telemetryKind !== 'recorded_simulation') throw new Error('REPORT_SOURCE_INVALID');
  const completedAtUtc = text(root.completedAtUtc, /^\d{4}-\d{2}-\d{2}T[0-9:.+-]+Z?$/u);
  if (!Number.isFinite(Date.parse(completedAtUtc))) throw new Error('REPORT_METADATA_INVALID');
  if (typeof root.reportJson !== 'string') throw new Error('REPORT_FILE_INVALID');
  const reportSha256 = text(root.reportSha256, /^[a-f0-9]{64}$/u);
  if (sha256Portable(new TextEncoder().encode(root.reportJson)) !== reportSha256) throw new Error('REPORT_DIGEST_MISMATCH');
  const u = record(root.usage);
  const usage = { inputTokens: count(u.inputTokens, 1_000_000), outputTokens: count(u.outputTokens, 100_000),
    reasoningTokens: count(u.reasoningTokens, 100_000), totalTokens: count(u.totalTokens, 1_100_000) };
  if (usage.totalTokens !== usage.inputTokens + usage.outputTokens || usage.reasoningTokens > usage.outputTokens) throw new Error('REPORT_USAGE_INVALID');
  let reportInput: unknown;
  try { reportInput = JSON.parse(root.reportJson); } catch { throw new Error('REPORT_OUTPUT_INVALID'); }
  const validated = validateAndRenderReport(reportInput, buildSessionEvidence(session));
  if (validated.status !== 'valid') throw new Error('REPORT_CLAIMS_UNSUPPORTED');
  // Copy only the permitted fields; never persist arbitrary file metadata.
  const saved: SavedProviderReport = { schemaVersion: 'blurr.saved-provider-report.v1', sessionSha256,
    telemetryKind: root.telemetryKind, model: text(root.model, /^nvidia\/[A-Za-z0-9._-]{1,160}$/u),
    responseId: text(root.responseId, /^[A-Za-z0-9._:-]{1,160}$/u), completedAtUtc, usage,
    reportJson: root.reportJson, reportSha256 };
  return { saved, report: validated.report };
};

export const readSavedProviderReportFile = async (file: { size: number; text(): Promise<string> }, session: StoredSession) => {
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > MAX_SAVED_REPORT_BYTES) throw new Error('REPORT_FILE_TOO_LARGE');
  return parseSavedProviderReport(await file.text(), session);
};

export class LocalProviderReportStore {
  private readonly storage: StorageLike;
  constructor(storage: StorageLike) { this.storage = storage; }
  read(session: StoredSession): ValidatedSavedReport | null {
    const raw = this.storage.getItem(PREFIX + session.canonicalSha256);
    return raw === null ? null : parseSavedProviderReport(raw, session);
  }
  save(input: string, session: StoredSession): ValidatedSavedReport {
    const validated = parseSavedProviderReport(input, session);
    this.storage.setItem(PREFIX + session.canonicalSha256, JSON.stringify(validated.saved));
    return validated;
  }
}
