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

  const isGoogleInitialized = React.useRef(false);

  // Load Google Identity Services script and render button
  useEffect(() => {
    if (!isAuthModalOpen) return;

    const initGoogle = () => {
      const google = (window as any).google;
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (!google?.accounts?.id || !clientId) return;

      try {
        if (!isGoogleInitialized.current) {
          google.accounts.id.initialize({
            client_id: clientId,
            callback: async (response: any) => {
              if (response.credential) {
                setIsLoading(true);
                setError(null);
                try {
                  await loginWithGoogle(response.credential);
                } catch (err: any) {
                  const msg =
                    err.response?.data?.error?.message ||
                    err.response?.data?.message ||
                    err.message ||
                    'Google authentication failed.';
                  setError(msg);
                } finally {
                  setIsLoading(false);
                }
              }
            },
            auto_select: false,
            cancel_on_tap_outside: true,
          });
          isGoogleInitialized.current = true;
        }

        const btnContainer = document.getElementById('google-signin-btn-container');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'continue_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: btnContainer.offsetWidth || 340,
          });
        }
      } catch (err) {
        console.warn('Google Identity initialization notice:', err);
      }
    };

    if (!(window as any).google?.accounts?.id) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setTimeout(initGoogle, 100);
      };
      document.body.appendChild(script);
    } else {
      setTimeout(initGoogle, 100);
    }
  }, [isAuthModalOpen, mode]);

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
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${mode === 'login'
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
          className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${mode === 'register'
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
      <div className="w-full flex justify-center min-h-[40px]">
        <div id="google-signin-btn-container" className="w-full flex justify-center [&>div]:w-full" />
      </div>

      {/* Security Footer Note */}
      <div className="mt-4 pt-3 border-t border-[#ECE9DF] flex items-center justify-center gap-1.5 text-[11px] text-[#5B6270]">
        <ShieldCheck className="w-3.5 h-3.5 text-[#2E6F5E]" />
        <span>Enterprise multi-tenant isolation & TLS 1.3 encrypted</span>
      </div>
    </Modal>
  );
};
