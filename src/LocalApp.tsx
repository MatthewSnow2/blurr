import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocalDashboard from './components/LocalDashboard';
import LocalHeader from './components/LocalHeader';
import SealedSessionUpload from './components/SealedSessionUpload';
import SessionReplay from './components/SessionReplay';
import { importSealedSessionFile, LocalSessionStore, type StoredSession } from './lib/sessionStore';

import { LocalProviderReportStore } from './coaching/savedProviderReport';
import { labelForSession, parseDatasetManifest } from './demo/datasets';
import { loadRecordedDemo, recordedDemoMessage } from './demo/recordedDemo';
import manifestJson from '../fixtures/provenance.json?raw';
// Emitted as separate same-origin assets so the GPL-3.0 run A data stays out of the Apache-2.0 bundle.
import demoCaptureUrl from '../data/f1tenth-silverstone/run-a-session.json?url&no-inline';
import demoReportUrl from '../data/f1tenth-silverstone/run-a-nebius-report.json?url&no-inline';

type Page = 'history' | 'upload' | 'replay';
type NavState = { page: Page; sessionId?: string };

const manifest = parseDatasetManifest(manifestJson);
const DEMO_CAPTURE_FILE = 'run-a-session.json';
const DEMO_REPORT_FILE = 'run-a-nebius-report.json';

function LocalApp() {
  const store = useMemo(() => new LocalSessionStore(window.localStorage), []);
  const [page, setPage] = useState<Page>('history');
  const [sessions, setSessions] = useState<StoredSession[]>([]);
  const [selected, setSelected] = useState<StoredSession | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refresh = useCallback(() => setSessions(store.list()), [store]);

  useEffect(() => refresh(), [refresh]);
  // Browser back/forward move between history, upload and an open replay instead of leaving the app.
  useEffect(() => {
    window.history.replaceState({ page: 'history' } satisfies NavState, '');
    const onPop = (event: PopStateEvent) => {
      const state = event.state as NavState | null;
      generation.current += 1;
      setIsImporting(false); setError(null); setVideoUrl(null);
      const session = state?.page === 'replay' ? store.list().find((entry) => entry.id === state.sessionId) : undefined;
      if (session) { setSelected(session); setPage('replay'); return; }
      setSelected(null);
      setPage(state?.page === 'upload' ? 'upload' : 'history');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [store]);
  const navigate = (state: NavState) => window.history.pushState(state, '');
  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const leaveReplay = () => {
    // Every replay/upload entry was pushed on top of a history entry, so stepping back keeps one consistent stack.
    if ((window.history.state as NavState | null)?.page !== 'history') { window.history.back(); return; }
    generation.current += 1;
    setIsImporting(false);
    setSelected(null);
    setVideoUrl(null);
    setError(null);
    setPage('history');
  };

  const importFiles = async (files: File[]) => {
    const currentGeneration = generation.current + 1;
    generation.current = currentGeneration;
    setIsImporting(true);
    setError(null);
    const capture = files.find((file) => file.name.toLowerCase().endsWith('.json'));
    const video = files.find((file) => file.name.toLowerCase().endsWith('.mp4'));
    if (!capture) {
      setError('A sealed JSON capture is required. MP4 cannot be used as telemetry.');
      setIsImporting(false);
      return;
    }

    try {
      const imported = await importSealedSessionFile(capture);
      if (generation.current !== currentGeneration) return;
      const stored = store.save(imported);
      refresh();
      setSelected(stored);
      setVideoUrl(video ? URL.createObjectURL(video) : null);
      // Replace the upload entry so Back from this replay returns to local history.
      window.history.replaceState({ page: 'replay', sessionId: stored.id } satisfies NavState, '');
      setPage('replay');
    } catch (caught: unknown) {
      if (generation.current === currentGeneration) {
        setError(caught instanceof Error ? caught.message : 'Session import failed');
      }
    } finally {
      if (generation.current === currentGeneration) setIsImporting(false);
    }
  };

  const openRecordedDemo = async () => {
    const current = ++generation.current;
    setIsImporting(true); setError(null);
    try {
      const { session, validated } = await loadRecordedDemo((url) => fetch(url), demoCaptureUrl, demoReportUrl, DEMO_CAPTURE_FILE);
      if (generation.current !== current) return;
      const stored = store.save(session);
      new LocalProviderReportStore(window.localStorage).save(JSON.stringify(validated.saved), stored);
      refresh(); setSelected(stored); setVideoUrl(null);
      navigate({ page: 'replay', sessionId: stored.id }); setPage('replay');
    } catch (caught: unknown) {
      if (generation.current === current) setError(recordedDemoMessage(caught, DEMO_CAPTURE_FILE, DEMO_REPORT_FILE));
    } finally { if (generation.current === current) setIsImporting(false); }
  };

  return (
    <div className="min-h-screen bg-carbon-950 text-white">
      <LocalHeader />
      <main className="px-4 sm:px-6 lg:px-8 py-10">
        {page === 'history' && error && <p role="alert" className="mb-5 text-orange-300">{error}</p>}
        {page === 'history' && (
          <LocalDashboard
            sessions={sessions}
            onLoadDemo={() => { void openRecordedDemo(); }}
            isLoadingDemo={isImporting}
            onImport={() => { generation.current += 1; setIsImporting(false); setError(null); navigate({ page: 'upload' }); setPage('upload'); }}
            onOpen={(session) => { generation.current += 1; setIsImporting(false); setError(null); setVideoUrl(null); setSelected(session); navigate({ page: 'replay', sessionId: session.id }); setPage('replay'); }}
          />
        )}
        {page === 'upload' && (
          <SealedSessionUpload
            error={error}
            isImporting={isImporting}
            onBack={leaveReplay}
            onFiles={importFiles}
          />
        )}
        {page === 'replay' && selected && (
          <SessionReplay session={selected} datasetLabel={labelForSession(manifest, selected.canonicalSha256)} videoUrl={videoUrl} onBack={leaveReplay} />
        )}
      </main>
    </div>
  );
}

export default LocalApp;
