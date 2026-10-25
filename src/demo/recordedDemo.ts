import { importSealedSessionFile, type StoredSession } from '../lib/sessionStore.ts';
import { parseSavedProviderReport, type ValidatedSavedReport } from '../coaching/savedProviderReport.ts';

type Fetcher = (url: string) => Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer>; text(): Promise<string> }>;

type RecordedDemoCode = 'DEMO_CAPTURE_MISSING' | 'DEMO_REPORT_MISSING' | 'DEMO_CAPTURE_INVALID' | 'DEMO_REPORT_INVALID';

export class RecordedDemoError extends Error {
  readonly code: RecordedDemoCode;
  readonly detail: string;
  constructor(code: RecordedDemoCode, detail: string) {
    super(code);
    this.code = code;
    this.detail = detail;
  }
}

/**
 * Fetch and validate the bundled demo pair. Any failure throws; there is no fallback
 * to another session, so an unrelated report can never be shown as valid.
 */
export const loadRecordedDemo = async (
  fetcher: Fetcher, captureUrl: string, reportUrl: string, captureName: string,
): Promise<{ session: StoredSession; validated: ValidatedSavedReport }> => {
  const [capture, report] = await Promise.all([fetcher(captureUrl), fetcher(reportUrl)]);
  if (!capture.ok) throw new RecordedDemoError('DEMO_CAPTURE_MISSING', `HTTP ${capture.status}`);
  if (!report.ok) throw new RecordedDemoError('DEMO_REPORT_MISSING', `HTTP ${report.status}`);
  const [bytes, reportJson] = await Promise.all([capture.arrayBuffer(), report.text()]);
  let session: StoredSession;
  try {
    session = await importSealedSessionFile({ name: captureName, size: bytes.byteLength, arrayBuffer: async () => bytes });
  } catch (caught) {
    throw new RecordedDemoError('DEMO_CAPTURE_INVALID', caught instanceof Error ? caught.message : 'unknown');
  }
  try {
    return { session, validated: parseSavedProviderReport(reportJson, session) };
  } catch (caught) {
    throw new RecordedDemoError('DEMO_REPORT_INVALID', caught instanceof Error ? caught.message : 'unknown');
  }
};

export const recordedDemoMessage = (caught: unknown, captureFile: string, reportFile: string): string => {
  if (!(caught instanceof RecordedDemoError)) return 'The recorded demo could not be opened or stored. Existing history is preserved.';
  switch (caught.code) {
    case 'DEMO_CAPTURE_MISSING': return `Recorded demo capture ${captureFile} could not be loaded (${caught.detail}). Rebuild the app from a checkout that includes data/f1tenth-silverstone/. Existing history is preserved.`;
    case 'DEMO_REPORT_MISSING': return `Recorded demo report ${reportFile} could not be loaded (${caught.detail}). Rebuild the app from a checkout that includes data/f1tenth-silverstone/. Existing history is preserved.`;
    case 'DEMO_CAPTURE_INVALID': return `Recorded demo capture ${captureFile} failed validation: ${caught.detail}. Nothing was opened; existing history is preserved.`;
    case 'DEMO_REPORT_INVALID': return caught.detail === 'REPORT_SESSION_MISMATCH'
      ? `Recorded demo report ${reportFile} belongs to a different session. Nothing was opened; existing history is preserved.`
      : `Recorded demo report ${reportFile} failed validation (${caught.detail}). Nothing was opened; existing history is preserved.`;
  }
};
