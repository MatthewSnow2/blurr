import { useMemo, useState } from 'react';
import type { StoredSession } from '../lib/sessionStore';
import { LocalProviderReportStore, readSavedProviderReportFile, type ValidatedSavedReport } from '../coaching/savedProviderReport';

const messages: Record<string, string> = {
  REPORT_SESSION_MISMATCH: 'This report belongs to a different session. Open its matching capture and try again.',
  REPORT_DIGEST_MISMATCH: 'The report digest does not match its contents.',
  REPORT_CLAIMS_UNSUPPORTED: 'This report contains claims the selected session cannot support.',
  REPORT_FILE_TOO_LARGE: 'Choose a saved report JSON file smaller than 128 KiB.',
};
const message = (e: unknown) => e instanceof Error && messages[e.message] ? messages[e.message] : 'The saved report could not be validated or stored. Your existing report is unchanged.';

export default function SavedProviderReport({ session }: { session: StoredSession }) {
  const store = useMemo(() => new LocalProviderReportStore(window.localStorage), []);
  const [initial] = useState(() => {
    try { return { value: store.read(session), error: null }; }
    catch { return { value: null, error: 'The stored report failed validation. Import a valid copy to replace it.' }; }
  });
  const [value, setValue] = useState<ValidatedSavedReport | null>(initial.value);
  const [error, setError] = useState<string | null>(initial.error);
  const [pending, setPending] = useState(false);
  const imported = async (file: File | undefined) => {
    if (!file) return;
    setPending(true); setError(null);
    try {
      const validated = await readSavedProviderReportFile(file, session);
      setValue(store.save(JSON.stringify(validated.saved), session));
    } catch (e) { setError(message(e)); }
    finally { setPending(false); }
  };
  return <section className="carbon-card p-6 border border-electric-500/30" aria-labelledby="saved-coaching-title">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 id="saved-coaching-title" className="text-2xl font-display font-bold">Saved Nebius coaching</h2>
        <p className="mt-2 text-chrome-300">Import a recorded response for this session. Claims are checked against its sealed evidence.</p>
      </div>
      <label className="chrome-button px-4 py-3 rounded-xl text-sm font-semibold">
        {pending ? 'Validating report…' : 'Import saved report'}
        <input aria-label="Import saved coaching report" className="block mt-2 max-w-full text-xs" type="file" accept=".json,application/json" disabled={pending}
          onChange={e => { void imported(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>
    {error && <p className="mt-4 text-orange-300" role="alert">{error}</p>}
    {value ? <div className="mt-6 space-y-5" aria-live="polite">
      <p className="text-electric-300 font-semibold">Validated against this session · {value.saved.telemetryKind === 'synthetic_replay' ? 'Synthetic replay telemetry' : 'Recorded simulator telemetry'}</p>
      <div><h3 className="font-semibold text-chrome-300">Evidence</h3><ul className="list-disc pl-6 mt-2 space-y-2">{value.report.claims.map(claim => <li key={claim.id}>{claim.rendered}</li>)}</ul></div>
      <div><h3 className="font-semibold text-chrome-300">Practice suggestion</h3>{value.report.interpretations.map((item, i) => <p className="mt-2" key={i}>{item.rendered}</p>)}</div>
      <details className="glass-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Recorded provider provenance</summary>
        <dl className="mt-3 space-y-2 break-all">
          <dt className="text-chrome-400">Model reported by the file</dt><dd>{value.saved.model}</dd>
          <dt className="text-chrome-400">Response ID</dt><dd className="font-mono">{value.saved.responseId}</dd>
          <dt className="text-chrome-400">Recorded response time</dt><dd>{value.saved.completedAtUtc}</dd>
          <dt className="text-chrome-400">Reported tokens</dt><dd>{value.saved.usage.inputTokens} input · {value.saved.usage.outputTokens} output, including {value.saved.usage.reasoningTokens} reasoning</dd>
          <dt className="text-chrome-400">Session SHA-256</dt><dd className="font-mono text-xs">{value.saved.sessionSha256}</dd>
        </dl>
        <p className="mt-3 text-chrome-400">This browser revalidates the claims, digest and session binding. Provider metadata comes from the imported file and is not independently authenticated here.</p>
      </details>
    </div> : <p className="mt-5 text-chrome-400">No validated saved report for this session yet.</p>}
    <p className="mt-5 text-sm text-chrome-400">Report import and viewing run locally. No new inference request is made. Braking and collision remain unavailable.</p>
  </section>;
}
