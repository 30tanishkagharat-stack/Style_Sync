import { ArrowRight, ExternalLink, Lock, Mail, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import editorialCoatImg from '../assets/images/wardrobe_camel_trench_1794629023997.jpg';
import type { AuthUser } from '../types';
import { BrandLogo } from './BrandLogo';
import { useFirebase } from './FirebaseProvider';

interface LoginViewProps {
  onSuccess: (user: AuthUser) => void;
}

export function LoginView({ onSuccess }: LoginViewProps) {
  const { signInWithGoogle, signInWithGoogleCredential } = useFirebase();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [browserAuthUrl, setBrowserAuthUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollTimerRef = useRef<number | null>(null);

  const stopDesktopGooglePolling = () => {
    if (pollTimerRef.current !== null) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopDesktopGooglePolling();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const res = await api.register({ name, email, password, gender: 'female' });
        onSuccess(res.user);
      } else {
        const res = await api.login({ email, password });
        onSuccess(res.user);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelDesktopGoogle = () => {
    stopDesktopGooglePolling();
    setBrowserAuthUrl(null);
    setGoogleSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    stopDesktopGooglePolling();
    setBrowserAuthUrl(null);
    setGoogleSubmitting(true);

    const desktopBridge = window.stylesyncDesktop;
    if (desktopBridge?.isElectron && desktopBridge.openExternalUrl) {
      try {
        const { nonce } = await api.startDesktopGoogleAuth();
        const authUrl = `${window.location.origin}/?desktop_google_nonce=${encodeURIComponent(nonce)}`;
        const opened = await desktopBridge.openExternalUrl(authUrl);
        if (!opened.ok) {
          throw new Error(opened.error || 'Could not open your browser for Google Sign-In.');
        }

        setBrowserAuthUrl(authUrl);
        const startedAt = Date.now();
        let pollingInFlight = false;

        pollTimerRef.current = window.setInterval(() => {
          if (pollingInFlight) return;
          if (Date.now() - startedAt > 5 * 60 * 1000) {
            stopDesktopGooglePolling();
            setBrowserAuthUrl(null);
            setGoogleSubmitting(false);
            setError('Google Sign-In timed out. Please try again.');
            return;
          }

          pollingInFlight = true;
          void api
            .pollDesktopGoogleAuth(nonce)
            .then(async (statusRes) => {
              if (statusRes.status === 'complete' && statusRes.user) {
                stopDesktopGooglePolling();
                setBrowserAuthUrl(null);
                setGoogleSubmitting(false);
                await signInWithGoogleCredential(
                  statusRes.googleIdToken,
                  statusRes.googleAccessToken
                ).catch(() => {});
                await desktopBridge.focusWindow?.().catch(() => {});
                onSuccess(statusRes.user);
              } else if (statusRes.status === 'expired') {
                stopDesktopGooglePolling();
                setBrowserAuthUrl(null);
                setGoogleSubmitting(false);
                setError('Google Sign-In session expired. Please try again.');
              }
            })
            .catch(() => {
              // Ignore transient poll errors while browser auth is in progress
            })
            .finally(() => {
              pollingInFlight = false;
            });
        }, 1200);
      } catch (err) {
        stopDesktopGooglePolling();
        setBrowserAuthUrl(null);
        setGoogleSubmitting(false);
        setError((err as Error).message);
      }
      return;
    }

    try {
      const fbUser = await signInWithGoogle();
      const idToken = await fbUser.getIdToken();
      const res = await api.loginWithFirebase({ idToken });
      onSuccess(res.user);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#292929] flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-5xl bg-[#FFFEFC] border border-[#E9DFD2] rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Editorial Visual Column */}
        <div className="hidden lg:flex lg:col-span-5 relative bg-[#E9DFD2]/50 flex-col justify-between p-8 border-r border-[#E9DFD2]">
          <div>
            <BrandLogo size="lg" subtitle="Personal AI Fashion Assistant & Digital Wardrobe" />
          </div>

          <div className="my-6 aspect-[3/4] rounded-xl overflow-hidden border border-[#E9DFD2]">
            <img
              src={editorialCoatImg}
              alt="Curated camel wool trench coat"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Right Form Column */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center">
          <div className="lg:hidden mb-6">
            <BrandLogo size="md" subtitle="Personal AI Wardrobe" />
          </div>

          <div className="mb-6">
            <h1 className="text-3xl font-semibold text-[#292929] font-serif">
              {mode === 'login' ? 'Welcome' : 'Create your wardrobe account'}
            </h1>
            <p className="text-sm text-[#85817B] mt-1">
              {mode === 'login'
                ? 'Sign in to access your saved garments, AI outfits, and calendar.'
                : 'Set up your local profile and styling preference to begin.'}
            </p>
          </div>

          {/* Auth Mode Switch */}
          <div className="inline-flex p-1 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] mb-6 self-start">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-[#292929] text-[#FFFEFC]'
                  : 'text-[#292929] hover:text-[#B76545]'
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
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-[#292929] text-[#FFFEFC]'
                  : 'text-[#292929] hover:text-[#B76545]'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-[#292929] mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#85817B] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex Morgan"
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#292929] mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#85817B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#292929] mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#85817B] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full pl-9 pr-3 py-2.5 text-sm bg-[#F7F3ED] border border-[#E9DFD2] rounded-lg text-[#292929] focus:outline-none focus:border-[#B76545]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#B76545] text-[#FFFEFC] hover:bg-[#B76545]/90 disabled:opacity-50 transition-colors"
            >
              {submitting
                ? mode === 'login'
                  ? 'Signing In...'
                  : 'Creating Account...'
                : mode === 'login'
                  ? 'Sign In'
                  : 'Create Account'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="my-4 flex items-center gap-3 text-[11px] text-[#85817B]">
            <div className="h-px flex-1 bg-[#E9DFD2]" />
            <span>or</span>
            <div className="h-px flex-1 bg-[#E9DFD2]" />
          </div>

          <button
            type="button"
            disabled={googleSubmitting || submitting}
            onClick={handleGoogleSignIn}
            className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg text-sm font-medium bg-[#FFFEFC] border border-[#E9DFD2] text-[#292929] hover:border-[#B76545] hover:bg-[#F7F3ED]/60 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.3 0 6.08-1.09 8.1-2.96l-3.88-3.05c-1.1.74-2.51 1.18-4.22 1.18-3.24 0-5.99-2.19-6.97-5.13H1.02v3.14C3.03 21.17 7.21 24 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.03 14.04c-.25-.74-.39-1.54-.39-2.36 0-.82.14-1.62.39-2.36V6.18H1.02A11.98 11.98 0 0 0 0 11.68c0 1.93.46 3.76 1.02 5.5l4.01-3.14Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.8 0 3.41.62 4.68 1.84l3.51-3.51C18.07 1.19 15.3 0 12 0 7.21 0 3.03 2.83 1.02 6.82l4.01 3.14c.98-2.94 3.73-5.21 6.97-5.21Z"
              />
            </svg>
            {googleSubmitting ? 'Waiting for Browser Sign-In...' : 'Continue with Google'}
          </button>

          {browserAuthUrl && (
            <div className="mt-3 p-3 rounded-lg bg-[#F7F3ED] border border-[#E9DFD2] text-xs text-[#292929] flex flex-wrap items-center justify-between gap-2">
              <span className="text-[#85817B]">
                Finish signing in inside the browser window that just opened.
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => window.stylesyncDesktop?.openExternalUrl?.(browserAuthUrl)}
                  className="inline-flex items-center gap-1 font-medium text-[#B76545] hover:underline"
                >
                  Re-open browser
                  <ExternalLink className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={handleCancelDesktopGoogle}
                  className="font-medium text-[#85817B] hover:text-[#292929]"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
