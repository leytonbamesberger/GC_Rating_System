import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { BrowserAuthError, InteractionStatus } from '@azure/msal-browser';
import { loginRequest } from '../lib/msal';
import ErrorMessage from '../components/ErrorMessage';

export default function LoginScreen() {
  const { instance, inProgress } = useMsal();
  const [error, setError] = useState('');
  const busy = inProgress !== InteractionStatus.None;

  async function signIn() {
    setError('');
    try {
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      // A redirect that never finished leaves MSAL's interaction flag set; clearing lets a retry work.
      if (err instanceof BrowserAuthError && err.errorCode === 'interaction_in_progress') {
        await instance.clearCache();
        setError('The previous sign-in did not finish. Please click Sign in again.');
        return;
      }
      console.error('[login] loginRedirect failed:', err);
      setError('Could not start sign-in.');
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-6 py-12">
      <div className="w-full max-w-sm">
        <p className="text-white/40 text-sm font-medium tracking-widest uppercase text-center mb-10">
          Sign In
        </p>
        {error && (
          <div className="mb-4">
            <ErrorMessage message={error} />
          </div>
        )}
        <button
          onClick={signIn}
          disabled={busy}
          className="w-full bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl px-6 py-4 transition-colors"
        >
          {busy ? 'Signing in...' : 'Sign in with Microsoft'}
        </button>
        <p className="text-white/40 text-xs text-center mt-4">Use your Legacy Mechanical Microsoft account.</p>
      </div>
    </div>
  );
}
