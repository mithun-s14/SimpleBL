import { useState, FormEvent } from 'react';
import { supabase } from '../supabase';

interface AuthModalProps {
  onDone: () => void;
}

export default function AuthModal({ onDone }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNotice(null);
    const { data, error } =
      mode === 'login'
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.href },
          });
    setLoading(false);
    if (error) setError(error.message);
    else if (data.session) onDone();
    else setNotice('Check your email to confirm your account, then log in.');
  };

  const inputClass =
    'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white w-full max-w-sm rounded-xl border border-gray-200 shadow-lg p-5 space-y-3 animate-slide-up"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-gray-900">
            {mode === 'login' ? 'Log in' : 'Create an account'}
          </h2>
          <button
            type="button"
            onClick={onDone}
            aria-label="Close"
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-400">Save studies to your own library.</p>

        <label className="block">
          <span className="text-xs text-gray-500">Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500">Password</span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {notice && <p className="text-sm text-brand-green-dark">{notice}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded-lg text-sm font-medium bg-brand-green text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? '…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>

        <p className="text-xs text-gray-500 text-center">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setNotice(null);
            }}
            className="text-brand-green hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </form>
    </div>
  );
}
