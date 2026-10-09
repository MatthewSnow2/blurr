import React from 'react';
import { Session } from '@supabase/supabase-js';

interface HeaderProps {
  session: Session | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ session, onLogout }) => {
  return (
    <header className="relative bg-carbon-texture bg-cover bg-center bg-fixed overflow-hidden">
      {/* Background Video */}
      <div className="absolute inset-0 w-full h-full">
        <video
          className="w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="https://images.pexels.com/photos/3802510/pexels-photo-3802510.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop"
        >
          <source src="https://videos.pexels.com/video-files/856973/856973-hd_1920_1080_25fps.mp4" type="video/mp4" />
          {/* Fallback for browsers that don't support video */}
        </video>
        
        {/* Video Overlay for Better Text Readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-carbon-950/95 via-carbon-900/85 to-carbon-950/95"></div>
        
        {/* Additional Subtle Pattern Overlay */}
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10">
        <div className="flex items-center justify-between h-24">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <img 
                  src="/THE ELITE DRIVING INTELLIGENCE.png" 
                  alt="APEXAI - The Elite Driving Intelligence" 
                  className="h-16 w-auto drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-electric-500/20 to-neon-500/20 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-8">

            {session ? (
              <div className="flex items-center space-x-4">
                <span className="text-white">Welcome, {session.user.email}</span>
                <button onClick={onLogout} className="chrome-button shimmer-effect px-4 py-2 rounded-lg text-white font-semibold text-sm transition-all duration-300 hover:scale-105">
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                {/* Auth buttons are on the landing page */}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Animated border with enhanced visibility */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-electric-500/70 to-transparent z-10"></div>
      
      {/* Subtle ambient glow effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-electric-500/5 pointer-events-none"></div>
    </header>
  );
};

export default Header;