import React from 'react';
import { Database, FilePlus2, Gauge, Route } from 'lucide-react';
import type { StoredSession } from '../lib/sessionStore';

interface LocalDashboardProps {
  sessions: StoredSession[];
  onImport: () => void;
  onLoadDemo: () => void;
  isLoadingDemo: boolean;
  onOpen: (session: StoredSession) => void;
}

const LocalDashboard: React.FC<LocalDashboardProps> = ({ sessions, onImport, onOpen, onLoadDemo, isLoadingDemo }) => (
  <div className="w-full max-w-6xl mx-auto space-y-8">
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
      <div>
        <h1 className="text-4xl font-display font-bold text-white">Sealed simulator sessions</h1>
        <p className="mt-2 text-chrome-300">Persistent browser-local history. No account, cloud storage, or public media upload.</p>
      </div>
      <button onClick={onImport} className="chrome-button px-6 py-3 rounded-xl text-white font-semibold flex items-center gap-2">
        <FilePlus2 className="h-5 w-5" />
        Import capture
      </button>
    </div>

    <div className="glass-card p-6 border border-electric-500/20">
      <h2 className="text-xl font-display font-bold">Recorded Nebius demo</h2>
      <p className="mt-2 text-chrome-300">Open the two-frame synthetic replay with its saved Nemotron response. The response came from one real Token Factory call on 15 October; opening it makes no new call.</p>
      <button disabled={isLoadingDemo} onClick={onLoadDemo} className="chrome-button mt-4 px-5 py-3 rounded-xl font-semibold disabled:opacity-50">{isLoadingDemo ? 'Opening recorded demo…' : 'Open recorded demo'}</button>
    </div>

    {sessions.length === 0 ? (
      <div className="carbon-card p-10 text-center">
        <Database className="h-12 w-12 text-chrome-500 mx-auto mb-4" />
        <p className="text-chrome-300">No validated local sessions yet.</p>
      </div>
    ) : (
      <div className="grid lg:grid-cols-2 gap-6">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => onOpen(session)}
            className="carbon-card p-6 text-left border border-electric-500/20 hover:border-electric-400/60 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-widest text-electric-400">{session.source} · {session.referenceKind}</div>
                <h2 className="mt-2 text-2xl font-display font-bold text-white">{session.circuitName}</h2>
                <p className="mt-1 text-sm text-chrome-400">{new Date(session.capturedAtUtc).toLocaleString()}</p>
              </div>
              <Route className="h-7 w-7 text-neon-400 shrink-0" />
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6">
              <div className="glass-card p-3">
                <div className="text-lg font-bold text-white">{session.sampleCount}</div>
                <div className="text-xs text-chrome-400">samples</div>
              </div>
              <div className="glass-card p-3">
                <div className="text-lg font-bold text-white">
                  {session.meanAbsLateralDeviationM === null ? String(session.droppedFrames) : `${session.meanAbsLateralDeviationM.toFixed(4)} m`}
                </div>
                <div className="text-xs text-chrome-400">{session.meanAbsLateralDeviationM === null ? 'dropped frames' : 'mean |lateral|'}</div>
              </div>
              <div className="glass-card p-3">
                <div className="text-lg font-bold text-white flex items-center gap-1"><Gauge className="h-4 w-4" />{session.durationS.toFixed(2)} s</div>
                <div className="text-xs text-chrome-400">{session.source === 'autodrive' ? 'reception span' : 'sim duration'}</div>
              </div>
            </div>
            <div className="mt-4 font-mono text-xs text-chrome-500 truncate">{session.canonicalSha256}</div>
          </button>
        ))}
      </div>
    )}
  </div>
);

export default LocalDashboard;
