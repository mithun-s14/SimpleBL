import { useState, useRef, KeyboardEvent, ChangeEvent } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { ChatMessage, SearchResult, Study } from '../types';
import TopicChip from './TopicChip';
import ResultCard from './ResultCard';
import StudyChatModal from './StudyChatModal';

const TOPICS = [
  'Strength',
  'Hypertrophy',
  'Nutrition',
  'Recovery',
  'Creatine',
  'Cardio',
  'Carbohydrates',
];

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  const [activeStudy, setActiveStudy] = useState<Study | null>(null);
  const [studyChats, setStudyChats] = useState<Record<string, ChatMessage[]>>({});
  const [studyFullTextAvailable, setStudyFullTextAvailable] = useState<Record<string, boolean>>({});
  const [studyChatLoading, setStudyChatLoading] = useState(false);

  const search = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Could not load results.');
      }

      const data = (await res.json()) as SearchResult;
      setResult(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load results. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleQueryChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setQuery(e.target.value);
    resizeTextarea();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setActiveChip(null);
      search(query);
    }
  };

  const handleChipClick = (topic: string) => {
    if (activeChip === topic) {
      setActiveChip(null);
      setQuery('');
      requestAnimationFrame(resizeTextarea);
      return;
    }
    setActiveChip(topic);
    setQuery(topic);
    search(topic);
    requestAnimationFrame(resizeTextarea);
  };

  const handleSearchClick = () => {
    setActiveChip(null);
    search(query);
  };

  const handleAskStudy = (study: Study) => {
    setActiveStudy(study);
  };

  const handleSendStudyQuestion = async (question: string) => {
    if (!activeStudy) return;
    const pmid = activeStudy.pmid;
    const priorMessages = studyChats[pmid] ?? [];
    const nextMessages: ChatMessage[] = [...priorMessages, { role: 'user', content: question }];
    setStudyChats((prev) => ({ ...prev, [pmid]: nextMessages }));
    setStudyChatLoading(true);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/study/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pmid, messages: nextMessages }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Could not get a response.');
      }

      const data = (await res.json()) as { reply: string; fullTextAvailable: boolean };
      setStudyFullTextAvailable((prev) => ({ ...prev, [pmid]: data.fullTextAvailable }));
      setStudyChats((prev) => ({
        ...prev,
        [pmid]: [...nextMessages, { role: 'assistant', content: data.reply }],
      }));
    } catch (err) {
      setStudyChats((prev) => ({
        ...prev,
        [pmid]: [
          ...nextMessages,
          {
            role: 'assistant',
            content:
              err instanceof Error
                ? err.message
                : 'Something went wrong. Please try again.',
          },
        ],
      }));
    } finally {
      setStudyChatLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <div className="absolute top-3 left-4 flex items-center pointer-events-none">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M6.5 11.5A5 5 0 1 0 6.5 1.5a5 5 0 0 0 0 10ZM13 13l-2.5-2.5"
              stroke="#9CA3AF"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <textarea
          ref={textareaRef}
          value={query}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Search any lifting topic…"
          rows={1}
          maxLength={1000}
          className="w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10 transition-all duration-200 shadow-sm resize-none overflow-hidden leading-normal"
        />
        <button
          onClick={handleSearchClick}
          disabled={loading || !query.trim()}
          className="absolute top-0 right-0 flex items-center px-3 h-11"
          aria-label="Search"
        >
          <div
            className={`p-1.5 rounded-lg transition-colors duration-200 ${
              loading || !query.trim()
                ? 'text-gray-300'
                : 'text-brand-green hover:bg-brand-green-light'
            }`}
          >
            {loading ? (
              <svg
                className="animate-spin"
                width="15"
                height="15"
                viewBox="0 0 15 15"
                fill="none"
              >
                <circle
                  cx="7.5"
                  cy="7.5"
                  r="5.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="11 22"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path
                  d="M2.5 7.5H12.5M8.5 3.5L12.5 7.5L8.5 11.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </button>
      </div>

      {/* Topic chips */}
      <div className="flex flex-wrap gap-2">
        {TOPICS.map((topic) => (
          <TopicChip
            key={topic}
            label={topic}
            active={activeChip === topic}
            onClick={() => handleChipClick(topic)}
          />
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex justify-center py-4">
          <ThinkingOrb state="connecting" size={64} />
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            className="flex-shrink-0 mt-0.5 text-red-400"
          >
            <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Result */}
      {result && !loading && <ResultCard result={result} onAskStudy={handleAskStudy} />}

      {/* Study chat modal */}
      {activeStudy && (
        <StudyChatModal
          study={activeStudy}
          messages={studyChats[activeStudy.pmid] ?? []}
          loading={studyChatLoading}
          fullTextAvailable={studyFullTextAvailable[activeStudy.pmid] ?? null}
          onSend={handleSendStudyQuestion}
          onClose={() => setActiveStudy(null)}
        />
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-14 text-gray-400 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="3" y="9.5" width="3" height="3" rx="0.75" stroke="#D1D5DB" strokeWidth="1.25" />
              <rect x="16" y="9.5" width="3" height="3" rx="0.75" stroke="#D1D5DB" strokeWidth="1.25" />
              <rect x="6" y="7.5" width="2" height="7" rx="0.75" stroke="#D1D5DB" strokeWidth="1.25" />
              <rect x="14" y="7.5" width="2" height="7" rx="0.75" stroke="#D1D5DB" strokeWidth="1.25" />
              <rect x="8" y="10" width="6" height="2" rx="0.75" stroke="#D1D5DB" strokeWidth="1.25" />
            </svg>
          </div>
          <p className="text-sm">Search a topic or pick a category above</p>
        </div>
      )}
    </div>
  );
}
