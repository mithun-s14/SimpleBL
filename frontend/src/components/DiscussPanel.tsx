import { FormEvent, useState } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { Study } from '../types';
import StudyChatModal from './StudyChatModal';
import { useStudyChat } from '../useStudyChat';

const STARTERS = [
  'What are the biggest limitations of this study?',
  'Argue against its main conclusion.',
  'Does this apply to trained lifters?',
];

export default function DiscussPanel() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Study[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Study | null>(null);
  const chat = useStudyChat('debate');

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/studies/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error('Search failed. Please try again.');
      const studies = (await res.json()) as Study[];
      // A PMID lookup that hits goes straight to the conversation
      if (/^\d+$/.test(query.trim()) && studies.length === 1) setActive(studies[0]);
      setResults(studies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (active) {
    const messages = chat.chats[active.pmid] ?? [];
    return (
      <div className="space-y-3">
        <button onClick={() => setActive(null)} className="text-xs text-gray-500 hover:text-gray-900">
          ← Back to results
        </button>
        <StudyChatModal
          inline
          study={active}
          messages={messages}
          loading={chat.loading}
          fullTextAvailable={chat.fullText[active.pmid] ?? null}
          onSend={(q) => chat.send(active.pmid, q)}
          onClose={() => setActive(null)}
          placeholder="Make a point, challenge a finding, or ask a question…"
          intro="Debate this study with me. I'll back points the paper supports, push back on ones it doesn't, and flag its limitations — using only what the paper says."
        />
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button
                key={s}
                onClick={() => chat.send(active.pmid, s)}
                className="px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs border border-gray-200 hover:bg-brand-green-light hover:text-brand-green-dark"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={search}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a study or enter a PMID…"
          maxLength={300}
          className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10 shadow-sm"
        />
      </form>

      {loading && (
        <div className="flex justify-center py-4">
          <ThinkingOrb state="connecting" size={64} />
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {results && results.length === 0 && (
        <p className="text-sm text-gray-500">No studies found. Try different keywords or a PMID.</p>
      )}
      {results && results.length > 0 && (
        <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
          {results.map((s) => (
            <li key={s.pmid}>
              <button
                onClick={() => setActive(s)}
                className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50"
              >
                {s.title}
                <span className="block text-xs text-gray-400 mt-0.5">PMID {s.pmid}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
