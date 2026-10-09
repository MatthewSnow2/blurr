import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AnalysisResult } from '../types/telemetry';
import { UploadCloud, Play, Video, ChevronLeft, ChevronRight } from 'lucide-react';

interface AnalysisSession {
  id: string;
  event_name: string;
  driver: string;
  vehicle: string;
  thumbnail_url: string | null;
  analysis_data: AnalysisResult;
  created_at: string;
}

interface DashboardProps {
  onSelectSession: (results: AnalysisResult) => void;
  onUploadNew: () => void;
  isDemoMode: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onSelectSession, onUploadNew, isDemoMode }) => {
  const [sessions, setSessions] = useState<AnalysisSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);

  useEffect(() => {
    console.log('Dashboard mounted. isDemoMode:', isDemoMode);
    const fetchSessions = async () => {
      if (isDemoMode) {
        setLoading(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to view your sessions.');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching sessions:', error);
        setError('Failed to load analysis sessions.');
      } else {
        setSessions(data as AnalysisSession[]);
      }
      setLoading(false);
    };

    fetchSessions();
  }, [isDemoMode]);

  const handleNext = () => {
    setCurrentSessionIndex((prevIndex) => (prevIndex + 1) % sessions.length);
  };

  const handlePrev = () => {
    setCurrentSessionIndex((prevIndex) => (prevIndex - 1 + sessions.length) % sessions.length);
  };

  if (loading) {
    return <div className="text-center text-white p-12">Loading your sessions...</div>;
  }

  if (error) {
    return <div className="text-center text-red-400 p-12">{error}</div>;
  }

  const currentSession = sessions[currentSessionIndex];

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12">
      <div className="text-center">
        <div className="flex items-center justify-center space-x-3 mb-4">
            <Video className="h-8 w-8 text-electric-400" />
            <h1 className="text-4xl font-display font-bold text-white">
              Grounded Post-Session Coaching Prototype
            </h1>
        </div>
        <p className="text-lg text-chrome-300 max-w-3xl mx-auto">
          Real-time driving stays at the simulator edge. This checkpoint validates sealed evidence and suppresses coaching claims that cannot be proved from stored measurements.
        </p>
      </div>

      {sessions.length === 0 ? (
        <div className="carbon-card p-8 text-center">
          <p className="text-chrome-300 mb-6">No session records are available in this environment.</p>
          <button
            onClick={onUploadNew}
            className="chrome-button shimmer-effect px-8 py-3 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 group"
          >
            <div className="flex items-center space-x-3">
              <UploadCloud className="h-6 w-6" />
              <span>Validate Local Telemetry</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Main Featured Card */}
          <div 
            className="carbon-card p-6 neon-glow group cursor-pointer"
            onClick={() => onSelectSession(currentSession.analysis_data)}
          >
            <div className="relative aspect-video bg-carbon-900 rounded-xl overflow-hidden">
                {currentSession.thumbnail_url ? (
                  <img
                    src={currentSession.thumbnail_url}
                    alt={currentSession.event_name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-chrome-500">
                    No session thumbnail
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center">
                    <Play className="h-20 w-20 text-white/70 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform group-hover:scale-110" />
                </div>
            </div>
            <div className="mt-4 text-white">
                <h3 className="text-2xl font-bold font-display group-hover:text-electric-400 transition-colors">{currentSession.event_name}</h3>
                <p className="text-chrome-300">Legacy session record; its stored analysis is not treated as a grounded report.</p>
                <div className="flex items-center space-x-4 mt-3 text-sm">
                    <span className="bg-carbon-700 px-3 py-1 rounded-full text-chrome-200">{new Date(currentSession.created_at).toLocaleDateString()}</span>
                    <span className="bg-electric-900/50 border border-electric-700 px-3 py-1 rounded-full text-electric-300 font-medium">{currentSession.driver}</span>
                </div>
            </div>
          </div>

          {/* Carousel Thumbnails */}
          <div className="relative flex items-center justify-center">
            <button onClick={handlePrev} className="absolute -left-12 p-2 rounded-full bg-carbon-700/50 hover:bg-carbon-600 transition-colors text-white">
              <ChevronLeft size={24} />
            </button>
            <div className="flex space-x-4 overflow-hidden py-2">
              {sessions.map((session, index) => (
                <button 
                  key={session.id} 
                  onClick={() => setCurrentSessionIndex(index)}
                  className={`w-64 h-40 rounded-lg overflow-hidden transition-all duration-300 shrink-0 border-2 ${currentSessionIndex === index ? 'border-electric-400 scale-105 shadow-lg shadow-electric-900/50' : 'border-transparent opacity-60 hover:opacity-100 hover:scale-105'}`}
                >
                  {session.thumbnail_url ? (
                    <img
                      src={session.thumbnail_url}
                      alt={session.event_name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-chrome-500">
                      No thumbnail
                    </div>
                  )}
                </button>
              ))}
            </div>
            <button onClick={handleNext} className="absolute -right-12 p-2 rounded-full bg-carbon-700/50 hover:bg-carbon-600 transition-colors text-white">
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
