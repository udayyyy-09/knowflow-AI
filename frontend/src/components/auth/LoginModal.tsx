import React, { useState, useEffect } from 'react';
import { Mail, Lock, User, AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useAuth } from '@/context/AuthContext';

export const LoginModal: React.FC = () => {
  const { isAuthModalOpen, closeAuthModal, authModalMode, login, register, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setMode(authModalMode);
    setError(null);
  }, [authModalMode, isAuthModalOpen]);

  // Load Google Identity Services script if not already present
  useEffect(() => {
    if ((window as any).google?.accounts?.id) return;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      // Keep script cached
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, password, first_name: firstName, last_name: lastName });
      }
      setEmail('');
      setPassword('');
      setFirstName('');
      setLastName('');
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Authentication failed.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    setError(null);
    const google = (window as any).google;
    if (!google?.accounts?.id) {
      setError('Google Sign-In is initializing. Please try again in a moment or use email/password.');
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setError('Google Client ID is not configured in .env file.');
      return;
    }

    try {
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: any) => {
          if (response.credential) {
            setIsLoading(true);
            try {
              await loginWithGoogle(response.credential);
            } catch (err: any) {
              const msg = err.response?.data?.error?.message || err.response?.data?.message || err.message || 'Google authentication failed.';
              setError(msg);
            } finally {
              setIsLoading(false);
            }
          }
        },
        auto_select: false,
        use_fedcm_for_prompt: false,
      });
      google.accounts.id.prompt();
    } catch (err: any) {
      setError('Could not initialize Google authentication.');
    }
  };

  return (
    <Modal
      isOpen={isAuthModalOpen}
      onClose={closeAuthModal}
      maxWidth="md"
    >
      {/* Brand & Header Section */}
      <div className="mb-5 text-center">
        

        <h3 className="text-xl font-serif font-bold text-[#1B1F27] tracking-tight">
          {mode === 'login' ? 'Welcome to KnowFlow' : 'Create an Enterprise Account'}
        </h3>
        <p className="text-xs text-[#5B6270] mt-1 max-w-sm mx-auto">
          {mode === 'login'
            ? 'Sign in to access your workspaces and verified documents.'
            : 'Start querying your internal company documents in seconds.'}
        </p>
      </div>

      {/* Mode Switcher Tab */}
      <div className="flex rounded-xl bg-[#ECE9DF] p-1 mb-5 border border-[#DDD9CC]">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'login'
              ? 'bg-white text-[#1B1F27] shadow-xs border border-[#DDD9CC]'
              : 'text-[#5B6270] hover:text-[#1B1F27]'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            mode === 'register'
              ? 'bg-white text-[#1B1F27] shadow-xs border border-[#DDD9CC]'
              : 'text-[#5B6270] hover:text-[#1B1F27]'
          }`}
        >
          Create Account
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === 'register' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1B1F27] mb-1">First Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5B6270] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Jane"
                  className="w-full bg-white border border-[#DDD9CC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#2E6F5E] focus:ring-1 focus:ring-[#2E6F5E] transition-all shadow-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1B1F27] mb-1">Last Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-[#5B6270] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Doe"
                  className="w-full bg-white border border-[#DDD9CC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#2E6F5E] focus:ring-1 focus:ring-[#2E6F5E] transition-all shadow-xs"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-[#1B1F27] mb-1">Work Email</label>
          <div className="relative">
            <Mail className="w-4 h-4 text-[#5B6270] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jane.doe@company.com"
              className="w-full bg-white border border-[#DDD9CC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#2E6F5E] focus:ring-1 focus:ring-[#2E6F5E] transition-all shadow-xs"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#1B1F27] mb-1">Password</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-[#5B6270] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-white border border-[#DDD9CC] rounded-xl pl-9 pr-3 py-2 text-xs text-[#1B1F27] placeholder-[#8C93A0] focus:outline-none focus:border-[#2E6F5E] focus:ring-1 focus:ring-[#2E6F5E] transition-all shadow-xs"
            />
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={isLoading}
          icon={<ArrowRight className="w-4 h-4" />}
          className="w-full mt-2"
        >
          {mode === 'login' ? 'Sign In to Workspace' : 'Create Account'}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-5 text-center">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[#DDD9CC]" />
        </div>
        <span className="relative bg-[#FDFCFA] px-3 text-[10px] uppercase font-bold tracking-wider text-[#5B6270]">
          Or continue with
        </span>
      </div>

      {/* Google Sign In */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2.5 bg-white hover:bg-[#ECE9DF] border border-[#DDD9CC] hover:border-[#1B1F27] rounded-xl py-2.5 px-4 text-xs font-semibold text-[#1B1F27] transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-[0.99]"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>Google One-Tap Workspace Sign-In</span>
      </button>

      {/* Security Footer Note */}
      <div className="mt-4 pt-3 border-t border-[#ECE9DF] flex items-center justify-center gap-1.5 text-[11px] text-[#5B6270]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#2E6F5E]" />
        <span>Enterprise multi-tenant isolation & TLS 1.3 encrypted</span>
      </div>
    </Modal>
  );
};
