import React from 'react';

interface LandingPageProps {
  onLogin: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="relative min-h-screen bg-carbon-900 text-white flex flex-col items-center justify-center p-8 overflow-hidden">
      {/* Background Gradient & Effects */}
      <div className="absolute inset-0 bg-gradient-to-br from-carbon-800 via-carbon-900 to-black"></div>
      <div className="absolute top-0 left-0 w-1/2 h-1/2 bg-electric-500/10 rounded-full filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-neon-500/10 rounded-full filter blur-3xl opacity-30 animate-pulse animation-delay-2000"></div>

      <div className="relative z-10 text-center">
        <h1 className="text-6xl md:text-8xl font-display font-bold mb-4">
          <span className="text-white">Apex</span><span className="text-red-500">AI</span>
        </h1>
        <p className="text-xl md:text-2xl text-chrome-300 max-w-2xl mx-auto mb-8">
          Your Personal AI Driving Coach. Upload your track day footage and telemetry to get instant, actionable feedback.
        </p>
        <button
          onClick={onLogin}
          className="bg-electric-500 hover:bg-electric-600 text-white font-bold py-4 px-8 rounded-lg text-lg transition-all duration-300 transform hover:scale-105 shadow-lg shadow-electric-500/20"
        >
          Get Started
        </button>
      </div>

    </div>
  );
};

export default LandingPage;
