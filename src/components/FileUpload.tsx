import React from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, ArrowLeft, Loader } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  isProcessing: boolean;
  onBack: () => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, isProcessing, onBack }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop: onFileSelect, 
    multiple: true,
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'video/mp4': ['.mp4'],
    }
  });

  return (
    <div className="max-w-4xl mx-auto">
      <div className="relative">
        <button 
          onClick={onBack}
          className="absolute -top-4 -left-40 text-chrome-400 hover:text-white transition-colors flex items-center space-x-2 group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform"/>
          <span>Back to Dashboard</span>
        </button>

        <div className="carbon-card p-8">
          <div {...getRootProps()} 
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors duration-300 cursor-pointer 
            ${isDragActive ? 'border-electric-400 bg-electric-900/20' : 'border-carbon-600 hover:border-electric-500/50'}`
          }>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center space-y-4 text-chrome-300">
              {isProcessing ? (
                <>
                  <Loader className="animate-spin h-16 w-16 text-electric-400" />
                  <p className="text-xl font-semibold">Processing...</p>
                  <p className="text-chrome-400">Please wait while we analyze your data.</p>
                </>
              ) : (
                <>
                  <UploadCloud className={`h-16 w-16 transition-colors ${isDragActive ? 'text-electric-300' : 'text-chrome-500'}`} />
                  <p className="text-xl font-semibold">Drag & drop files here</p>
                  <p className="text-chrome-400">or click to select files</p>
                  <p className="text-sm text-chrome-500 mt-2">CSV and JSON telemetry must identify measurement units. MP4 is optional local context only.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="text-center mt-8">
          <div className="glass-card p-6 max-w-2xl mx-auto">
            <p className="text-lg text-chrome-300">Upload telemetry, with optional local video context</p>
            <p className="text-sm text-chrome-500 mt-2">Video-only uploads are rejected because video is not telemetry evidence.</p>
            <p className="text-chrome-300 leading-relaxed">
              This local flow validates inputs while the sealed-session import pipeline is completed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
