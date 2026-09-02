import { useState } from 'react';
import Header from './components/Header';
import SearchPanel from './components/SearchPanel';
import KeenanPanel from './components/KeenanPanel';
import ModeToggle, { Mode } from './components/ModeToggle';

// The server's KEENAN_WIKI_ENABLED cannot reach a static bundle, so the tab is
// gated at build time (see .github/workflows/deploy.yml). The server flag stays
// authoritative -- the API returns 503 when the feature is off there.
const KEENAN_ENABLED = import.meta.env.VITE_KEENAN_WIKI_ENABLED === 'true';

export default function App() {
  const [mode, setMode] = useState<Mode>('studies');

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-content mx-auto px-4 py-8 sm:py-10">
        <Header />

        {KEENAN_ENABLED && (
          <div className="mt-6 flex justify-center">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        )}

        <div className="mt-6">
          {KEENAN_ENABLED && mode === 'keenan' ? <KeenanPanel /> : <SearchPanel />}
        </div>
      </div>
    </div>
  );
}
