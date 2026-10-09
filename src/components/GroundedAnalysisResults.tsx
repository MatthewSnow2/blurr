import React from 'react';
import { AlertTriangle, ArrowLeft, Database, ShieldCheck, Video } from 'lucide-react';
import { AnalysisResult } from '../types/telemetry';

interface GroundedAnalysisResultsProps {
  results: AnalysisResult;
  audioUrl?: string | null;
  videoUrl?: string | null;
  onPlayAudio: () => void;
  isPlayingAudio: boolean;
  onBack?: () => void;
}

const GroundedAnalysisResults: React.FC<GroundedAnalysisResultsProps> = ({ videoUrl, onBack }) => (
  <div className="w-full max-w-5xl mx-auto space-y-8">
    <div className="carbon-card p-8 border border-orange-500/30">
      <div className="flex items-start gap-4">
        <AlertTriangle className="h-8 w-8 text-orange-400 shrink-0" />
        <div>
          <h2 className="text-3xl font-display font-bold text-white">
            Evidence-grounded report unavailable
          </h2>
          <p className="mt-3 text-chrome-300 leading-relaxed">
            This build intentionally suppresses legacy heuristic scores, free-form coaching,
            and fabricated session details. A report will be shown only after its claims pass
            the grounded report contract against a sealed evidence store.
          </p>
        </div>
      </div>
    </div>

    <div className="grid md:grid-cols-2 gap-6">
      <div className="glass-card p-6 border border-electric-500/20">
        <ShieldCheck className="h-7 w-7 text-electric-400 mb-3" />
        <h3 className="text-xl font-display font-bold text-white">Grounded rendering</h3>
        <p className="mt-2 text-chrome-300">
          Numbers, comparisons, trends, events, and absences must resolve to stored evidence
          with compatible units and scope before they can be rendered.
        </p>
      </div>

      <div className="glass-card p-6 border border-neon-500/20">
        <Database className="h-7 w-7 text-neon-400 mb-3" />
        <h3 className="text-xl font-display font-bold text-white">Provider boundary offline</h3>
        <p className="mt-2 text-chrome-300">
          Live Nebius transport is not configured in this local build. Provider responses are
          rejected unless the input session is sealed and the returned report validates.
        </p>
      </div>
    </div>

    {videoUrl && (
      <div className="carbon-card p-6 border border-chrome-600/30">
        <h3 className="text-xl font-display font-bold text-white flex items-center mb-4">
          <Video className="h-6 w-6 text-electric-400 mr-2" />
          Local session video
        </h3>
        <video src={videoUrl} className="w-full rounded-lg" controls />
        <p className="mt-3 text-sm text-chrome-400">
          The video is local context only. It is not treated as telemetry evidence.
        </p>
      </div>
    )}

    {onBack && (
      <button
        onClick={onBack}
        className="flex items-center text-electric-400 hover:text-electric-300 transition-colors font-semibold"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to Dashboard
      </button>
    )}
  </div>
);

export default GroundedAnalysisResults;
