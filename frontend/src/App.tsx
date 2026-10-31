import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Header from './components/Header';
import SearchPanel from './components/SearchPanel';
import AuthModal from './components/AuthModal';
import DiscussPanel from './components/DiscussPanel';
import { supabase } from './supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [page, setPage] = useState<'search' | 'discuss'>('search');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-content mx-auto px-4 py-8 sm:py-10">
        <Header
          email={session?.user.email ?? null}
          onLogin={() => setShowAuth(true)}
          onLogout={() => supabase.auth.signOut()}
        />
        <div className="flex justify-center gap-1 text-xs">
          {(['search', 'discuss'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`px-3 py-1.5 rounded-full ${
                page === p ? 'bg-brand-green-light text-brand-green-dark font-medium' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {p === 'search' ? 'Search topics' : 'Discuss a study'}
            </button>
          ))}
        </div>
        {/* hidden, not unmounted, so each tab keeps its state when switching */}
        <div className="mt-6" hidden={page !== 'search'}>
          <SearchPanel userId={session?.user.id ?? null} onRequireLogin={() => setShowAuth(true)} />
        </div>
        <div className="mt-6" hidden={page !== 'discuss'}>
          <DiscussPanel />
        </div>
      </div>
      {showAuth && <AuthModal onDone={() => setShowAuth(false)} />}
    </div>
  );
}
