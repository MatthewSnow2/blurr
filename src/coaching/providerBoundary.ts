import {
  REPORT_CONTRACT_VERSION,
  type EvidenceStore,
  type ReportValidationResult,
  validateAndRenderReport,
} from './reportContract.ts';

export interface SealedEvidenceBundle {
  status: 'sealed';
  sessionId: string;
  sessionSha256: string;
  sealedAtUtc: string;
  evidence: EvidenceStore;
}

export interface PostSessionProviderRequest {
  contractVersion: typeof REPORT_CONTRACT_VERSION;
  sessionId: string;
  sessionSha256: string;
  evidence: EvidenceStore;
}

export interface CoachingTransport {
  complete(request: PostSessionProviderRequest): Promise<unknown>;
}

const MAX_METRICS = 200;
const MAX_EVENTS = 200;
const MAX_OCCURRENCES = 100;

const assertSealedBundle = (bundle: SealedEvidenceBundle): void => {
  if (bundle.status !== 'sealed') throw new Error('SESSION_NOT_SEALED');
  if (!bundle.sessionId.trim()) throw new Error('SESSION_ID_REQUIRED');
  if (!/^[0-9a-f]{64}$/u.test(bundle.sessionSha256)) throw new Error('SESSION_DIGEST_INVALID');
  if (!Number.isFinite(Date.parse(bundle.sealedAtUtc))) throw new Error('SEALED_AT_INVALID');
  if (Object.keys(bundle.evidence.metrics).length > MAX_METRICS) throw new Error('EVIDENCE_BUNDLE_TOO_LARGE');
  if (Object.keys(bundle.evidence.events).length > MAX_EVENTS) throw new Error('EVIDENCE_BUNDLE_TOO_LARGE');
  if (Object.keys(bundle.evidence.occurrences).length > MAX_OCCURRENCES) throw new Error('EVIDENCE_BUNDLE_TOO_LARGE');
};

/**
 * The only cloud-facing seam in this slice. It has no default HTTP client,
 * accepts only a sealed post-session bundle, and validates the returned report
 * before any model output can be rendered.
 */
export const requestPostSessionCoaching = async (
  bundle: SealedEvidenceBundle,
  transport: CoachingTransport,
): Promise<ReportValidationResult> => {
  assertSealedBundle(bundle);
  const response = await transport.complete({
    contractVersion: REPORT_CONTRACT_VERSION,
    sessionId: bundle.sessionId,
    sessionSha256: bundle.sessionSha256,
    evidence: bundle.evidence,
  });
  return validateAndRenderReport(response, bundle.evidence);
};
