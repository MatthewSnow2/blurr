import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LocalDashboard from './components/LocalDashboard';
import LocalHeader from './components/LocalHeader';
import SealedSessionUpload from './components/SealedSessionUpload';
import SessionReplay from './components/SessionReplay';
import { importSealedSessionFile, LocalSessionStore, type StoredSession } from './lib/sessionStore';

type Page = 'history' | 'upload' | 'replay';

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
  useEffect(() => () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  }, [videoUrl]);

  const leaveReplay = () => {
    generation.current += 1;
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
      setPage('replay');
    } catch (caught: unknown) {
      if (generation.current === currentGeneration) {
        setError(caught instanceof Error ? caught.message : 'Session import failed');
      }
    } finally {
      if (generation.current === currentGeneration) setIsImporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-carbon-950 text-white">
      <LocalHeader />
      <main className="px-4 sm:px-6 lg:px-8 py-10">
        {page === 'history' && (
          <LocalDashboard
            sessions={sessions}
            onImport={() => { setError(null); setPage('upload'); }}
            onOpen={(session) => { setSelected(session); setPage('replay'); }}
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
          <SessionReplay session={selected} videoUrl={videoUrl} onBack={leaveReplay} />
        )}
      </main>
    </div>
  );
}

export default LocalApp;
