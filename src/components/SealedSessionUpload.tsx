import React from 'react';
import { AlertTriangle, ArrowLeft, Loader, UploadCloud } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

interface SealedSessionUploadProps {
  error: string | null;
  isImporting: boolean;
  onBack: () => void;
  onFiles: (files: File[]) => void;
}

const SealedSessionUpload: React.FC<SealedSessionUploadProps> = ({ error, isImporting, onBack, onFiles }) => {
  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    accept: {
      'application/json': ['.json'],
      'video/mp4': ['.mp4'],
    },
    multiple: true,
    onDrop: onFiles,
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={onBack} className="flex items-center text-electric-400 hover:text-electric-300">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Back to history
      </button>

      <div className="carbon-card p-8">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
            isDragActive ? 'border-electric-400 bg-electric-900/20' : 'border-carbon-600 hover:border-electric-500/50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4 text-chrome-300">
            {isImporting ? <Loader className="h-16 w-16 animate-spin text-electric-400" /> : <UploadCloud className="h-16 w-16 text-chrome-500" />}
            <p className="text-xl font-semibold">
              {isImporting ? 'Validating and sealing locally...' : 'Import a sealed F1TENTH capture'}
            </p>
            <p className="text-sm text-chrome-400">
              JSON is required. An MP4 may be selected as temporary local context, but it is never telemetry evidence or uploaded.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="glass-card p-5 border border-red-500/40 text-red-300 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card p-5 text-sm text-chrome-300">
        Imports are bounded to 15 MiB and 50,000 samples. Sequence, simulator-relative time, finite metric values, raceline identity, and reported summaries are validated before history is updated.
      </div>
    </div>
  );
};

export default SealedSessionUpload;
