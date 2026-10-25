import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import Header from './components/Header';
import SearchPanel from './components/SearchPanel';
import AuthModal from './components/AuthModal';
import { supabase } from './supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [showAuth, setShowAuth] = useState(false);

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
        <div className="mt-6">
          <SearchPanel userId={session?.user.id ?? null} onRequireLogin={() => setShowAuth(true)} />
        </div>
      </div>
      {showAuth && <AuthModal onDone={() => setShowAuth(false)} />}
    </div>
  );
}
