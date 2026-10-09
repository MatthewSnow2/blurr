import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { X, Mail, KeyRound } from 'lucide-react';

interface AuthProps {
  onClose: () => void;
}

const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
    } else {
      onClose();
    }
    setLoading(false);
  };

  const handleSignUp = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setError(error.message);
    } else {
      setMessage('Check your email for the confirmation link!');
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 bg-carbon-950/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="carbon-card p-8 rounded-2xl max-w-md w-full relative border border-electric-500/20">
        <button onClick={onClose} className="absolute top-4 right-4 text-chrome-400 hover:text-white transition-colors">
          <X className="h-6 w-6" />
        </button>

        <div className="text-center mb-8">
          <h2 className="text-3xl font-display font-bold text-white">
            {authMode === 'signIn' ? 'Welcome Back' : 'Create Account'}
          </h2>
          <p className="text-chrome-300 mt-2">
            {authMode === 'signIn' ? 'Sign in to access your analysis' : 'Join to start analyzing your driving'}
          </p>
        </div>

        <form onSubmit={authMode === 'signIn' ? handleLogin : handleSignUp} className="space-y-6">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-chrome-400" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-carbon-800/50 border border-carbon-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-chrome-400 focus:ring-2 focus:ring-electric-500 focus:outline-none transition-all"
            />
          </div>
          <div className="relative">
            <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-chrome-400" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-carbon-800/50 border border-carbon-700 rounded-lg pl-12 pr-4 py-3 text-white placeholder-chrome-400 focus:ring-2 focus:ring-electric-500 focus:outline-none transition-all"
            />
          </div>

          {error && <p className="text-red-400 text-center">{error}</p>}
          {message && <p className="text-green-400 text-center">{message}</p>}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full chrome-button shimmer-effect px-8 py-3 rounded-xl text-white font-semibold text-lg transition-all duration-300 hover:scale-105 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : (authMode === 'signIn' ? 'Sign In' : 'Sign Up')}
            </button>
          </div>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => {
              setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
              setMessage(null);
            }}
            className="text-sm text-electric-400 hover:text-electric-300 font-semibold transition-colors"
          >
            {authMode === 'signIn' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Auth;
