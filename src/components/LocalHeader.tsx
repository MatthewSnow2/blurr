import React from 'react';
import { Gauge, HardDrive } from 'lucide-react';

const LocalHeader: React.FC = () => (
  <header className="border-b border-electric-500/20 bg-carbon-950/95">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Gauge className="h-9 w-9 text-electric-400" />
        <div>
          <div className="text-2xl font-display font-bold text-white">Blurr</div>
          <div className="text-xs uppercase tracking-widest text-chrome-400">Simulator evidence lab</div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-sm text-neon-400">
        <HardDrive className="h-4 w-4" />
        Local-only session storage
      </div>
    </div>
  </header>
);

export default LocalHeader;
