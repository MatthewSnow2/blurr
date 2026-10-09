import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabaseClient';
import { AnalysisResult } from './types/telemetry';
import { parseTelemetryFile } from './utils/telemetryParser';
import { analyzeTelemetryData } from './utils/telemetryAnalyzer';
import { Session, AuthChangeEvent } from '@supabase/supabase-js';

import Header from './components/Header';
import FileUpload from './components/FileUpload';

import AnalysisResults from './components/GroundedAnalysisResults';
import Processing from './components/Processing';
import Dashboard from './components/Dashboard';
import LandingPage from './components/LandingPage';
import SessionDetailsForm from './components/SessionDetailsForm';

function App() {
  // --- DEMO MODE --- //
  // Set to `true` to bypass login and go straight to the upload page.
  const isDemoMode = true;
  const mockSession = {
    user: { id: crypto.randomUUID(), email: 'demo@example.com', aud: 'authenticated' },
    access_token: 'demo-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'demo-refresh-token',
  } as Session;

  const [session, setSession] = useState<Session | null>(isDemoMode ? mockSession : null);
  const [page, setPage] = useState<'landing' | 'dashboard' | 'upload' | 'processing' | 'results'>('landing');
  
  const [analysisResults, setAnalysisResults] = useState<AnalysisResult | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // State for session saving flow
  const [showSessionDetailsForm, setShowSessionDetailsForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAnalysis, setPendingAnalysis] = useState<AnalysisResult | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  // Auth effect
  useEffect(() => {
    if (isDemoMode) return; // Disable auth listeners in demo mode

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setPage(session ? 'dashboard' : 'landing');
    };
    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setSession(session);
      if (_event === 'SIGNED_IN') setPage('dashboard');
      if (_event === 'SIGNED_OUT') setPage('landing');
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode]);

  const handleFileSelect = async (files: File[]) => {
    const telemetryFile = files.find(f => f.name.endsWith('.csv') || f.name.endsWith('.json'));
    const video = files.find(f => f.name.endsWith('.mp4'));

    if (!telemetryFile) {
      alert('Video-only analysis is unavailable because Blurr does not extract telemetry from MP4 files. Provide a unit-labelled CSV or JSON session.');
      return;
    }

    if (video) {
      setVideoFile(video);
    }

    if (telemetryFile) {
      setPage('processing');
      try {
        const data = await parseTelemetryFile(telemetryFile);
        const results = analyzeTelemetryData(data);
        setPendingAnalysis(results);
        setShowSessionDetailsForm(true);
      } catch (error: unknown) {
        console.error('Error processing file:', error);
        alert('Error processing file. Please check the format and try again.');
        setPage('upload');
      }
    }
  };

  const handleSaveSession = async (details: { eventName: string, driver: string, vehicle: string }) => {
    if (!pendingAnalysis || !session?.user) return;

    void details;
    setIsSaving(true);
    if (!isDemoMode) {
      alert('Remote persistence is disabled until sealed-session storage is implemented.');
      setIsSaving(false);
      return;
    }

    // Local media is optional context only; it is never telemetry evidence.
    const localVideoUrl = videoFile ? URL.createObjectURL(videoFile) : null;
    setShowSessionDetailsForm(false);
    setPage('processing');
    setTimeout(() => {
      setAnalysisResults(pendingAnalysis);
      setVideoUrl(localVideoUrl);
      setPage('results');
      setPendingAnalysis(null);
      setVideoFile(null);
    }, 800);
    setIsSaving(false);
  };

  const handleCancelSave = () => {
    setShowSessionDetailsForm(false);
    setPendingAnalysis(null);
    setVideoFile(null);
    setPage('upload'); // Go back to upload screen
  };

  const handleSelectSession = (results: AnalysisResult, video?: string | null) => {
    setAnalysisResults(results);
    setVideoUrl(video || null);
    setPage('results');
  };

  const handleBackToDashboard = () => {
    if (videoUrl?.startsWith('blob:')) URL.revokeObjectURL(videoUrl);
    setAnalysisResults(null);
    setVideoUrl(null);
    setPage('dashboard');
  }

  const handleLogin = () => {
    // In demo mode, this button bypasses login and goes straight to the upload page.
    setPage('upload');
  };

  const renderPage = () => {
    switch (page) {
      case 'landing':
        return <LandingPage onLogin={handleLogin} />;
      case 'dashboard':
        return <Dashboard onSelectSession={handleSelectSession} onUploadNew={() => setPage('upload')} isDemoMode={isDemoMode} />;
      case 'upload':
        return <FileUpload onFileSelect={handleFileSelect} isProcessing={isSaving} onBack={() => setPage('dashboard')} />;
      case 'processing':
        return <Processing />;
      case 'results':
        return analysisResults && (
          <AnalysisResults 
            results={analysisResults} 
            videoUrl={videoUrl}
            onBack={handleBackToDashboard}
            // Audio props are not used for now, but keeping for potential future use
            audioUrl={null}
            isPlayingAudio={false}
            onPlayAudio={() => {}}
          />
        );
      default:
        return <LandingPage onLogin={() => setPage('dashboard')} />;
    }
  };

  return (
    <div className="min-h-screen bg-carbon-950 font-sans text-white">
      <Header session={session} onLogout={async () => await supabase.auth.signOut()} />
      <main className="px-4 py-8 flex justify-center">
        {renderPage()}
      </main>
      <audio ref={audioRef} />
      {showSessionDetailsForm && pendingAnalysis && (
        <SessionDetailsForm
          isOpen={showSessionDetailsForm}
          onClose={handleCancelSave}
          onSave={handleSaveSession}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}

export default App;
