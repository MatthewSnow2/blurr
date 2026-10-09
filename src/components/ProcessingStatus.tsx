import React from 'react';
import { Loader2 } from 'lucide-react';

const ProcessingStatus: React.FC = () => {
  return (
    <div className="w-full max-w-md mx-auto">
      <div className="carbon-card p-10 text-center">
        <div className="flex flex-col items-center justify-center space-y-4">
          <Loader2 className="animate-spin h-16 w-16 text-electric-400" />
          <h2 className="text-2xl font-display font-bold text-white">Processing Analysis</h2>
          <p className="text-chrome-300">
            Our AI is analyzing your driving data. Please wait a moment...
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProcessingStatus;