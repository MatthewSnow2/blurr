import { useState } from 'react';
import type { StoredSession } from '../lib/sessionStore';
import { isLiveEligible, liveCoachingMessage, requestLiveCoaching, type LiveCoachingResult } from '../coaching/liveCoaching';

export default function LiveCoaching({ session }: { session: StoredSession }) {
  const [result, setResult] = useState<LiveCoachingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const eligible = isLiveEligible(session);
  const run = async () => {
    setPending(true); setError(null);
    try { setResult(await requestLiveCoaching(session, (url, init) => fetch(url, init))); }
    catch (e) { setError(liveCoachingMessage(e)); }
    finally { setPending(false); }
  };
  return <section className="carbon-card p-6 border border-electric-500/30" aria-labelledby="live-coaching-title">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 id="live-coaching-title" className="text-2xl font-display font-bold">Live Nemotron coaching</h2>
        <p className="mt-2 text-chrome-300">Sends this session's sealed evidence (metrics, not raw telemetry) to NVIDIA Nemotron 3 Super on Nebius Token Factory now, then checks the reply against the same evidence.</p>
      </div>
      {eligible && <button type="button" className="chrome-button px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-60" disabled={pending} onClick={() => { void run(); }}>
        {pending ? 'Asking Nemotron…' : 'Run live coaching'}
      </button>}
    </div>
    {!eligible && <p className="mt-4 text-chrome-400">Live coaching runs only for the seven bundled simulator captures, so an imported capture cannot spend the hosted key.</p>}
    {error && <p className="mt-4 text-orange-300" role="alert">{error}</p>}
    {result && <div className="mt-6 space-y-5" aria-live="polite">
      <p className="text-electric-300 font-semibold">Live response, validated against this session · {result.validated.saved.completedAtUtc}</p>
      <div><h3 className="font-semibold text-chrome-300">Evidence</h3><ul className="list-disc pl-6 mt-2 space-y-2">{result.validated.report.claims.map(claim => <li key={claim.id}>{claim.rendered}</li>)}</ul></div>
      <div><h3 className="font-semibold text-chrome-300">Practice suggestion</h3>{result.validated.report.interpretations.map((item, i) => <p className="mt-2" key={i}>{item.rendered}</p>)}</div>
      <details className="glass-card p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Live call provenance</summary>
        <dl className="mt-3 space-y-2 break-all">
          <dt className="text-chrome-400">Model</dt><dd>{result.validated.saved.model}</dd>
          <dt className="text-chrome-400">Response ID</dt><dd className="font-mono">{result.validated.saved.responseId}</dd>
          <dt className="text-chrome-400">Reported tokens</dt><dd>{result.validated.saved.usage.inputTokens} input · {result.validated.saved.usage.outputTokens} output, including {result.validated.saved.usage.reasoningTokens} reasoning</dd>
          <dt className="text-chrome-400">Provider round trip</dt><dd>{result.live.durationMs === null ? 'not reported' : `${(result.live.durationMs / 1000).toFixed(1)} s`}</dd>
          <dt className="text-chrome-400">Request SHA-256</dt><dd className="font-mono text-xs">{result.live.requestSha256}</dd>
          <dt className="text-chrome-400">Cost ceiling per call</dt><dd>USD {result.live.costCeilingUsd} (at most {result.live.dailyCap} live calls a day on this demo)</dd>
        </dl>
        <p className="mt-3 text-chrome-400">The response ID and token counts come from the server's call and are not independently authenticated in the browser. The claims, digest and session binding are checked here.</p>
      </details>
    </div>}
  </section>;
}
