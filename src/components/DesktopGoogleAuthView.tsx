import { CheckCircle2, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { api } from '../api';
import { BrandLogo } from './BrandLogo';
import { useFirebase } from './FirebaseProvider';

interface DesktopGoogleAuthViewProps {
  nonce: string;
}

export function DesktopGoogleAuthView({ nonce }: DesktopGoogleAuthViewProps) {
  const { signInWithGoogleWithTokens } = useFirebase();
  const [submitting, setSubmitting] = useState(false);
  const [completedEmail, setCompletedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleContinue = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const { user, googleIdToken, googleAccessToken } = await signInWithGoogleWithTokens();
      const idToken = await user.getIdToken();
      const res = await api.completeDesktopGoogleAuth({
        nonce,
        idToken,
        googleIdToken,
        googleAccessToken,
      });
      setCompletedEmail(res.email);
    } catch (err) {
      setError((err as Error).message || 'Could not complete Google Sign-In.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F3ED] text-[#292929] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#FFFEFC] border border-[#E9DFD2] rounded-2xl p-8 text-center shadow-sm">
        <div className="flex justify-center mb-6">
          <BrandLogo size="lg" />
        </div>

        {completedEmail ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif font-semibold text-[#292929]">
              Signed in to StyleSync
            </h1>
            <p className="text-sm text-[#85817B]">
              Verified <span className="font-medium text-[#292929]">{completedEmail}</span>. Your
              StyleSync Desktop app is now signing you in automatically.
            </p>
            <p className="text-xs text-[#85817B] pt-2">You can close this browser tab.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <h1 className="text-2xl font-serif font-semibold text-[#292929]">
                Sign in to StyleSync Desktop
              </h1>
              <p className="text-sm text-[#85817B] mt-1.5">
                Complete Google Sign-In in your browser, then return directly to the StyleSync app.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800 text-left">
                {error}
              </div>
            )}

            <button
              type="button"
              disabled={submitting}
              onClick={handleContinue}
              className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-lg text-sm font-medium bg-[#292929] text-[#FFFEFC] hover:bg-[#292929]/90 disabled:opacity-50 transition-colors"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
              <span>{submitting ? 'Connecting Google Account...' : 'Continue with Google'}</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-75" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
