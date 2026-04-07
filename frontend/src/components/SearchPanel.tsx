import { useState, KeyboardEvent } from 'react';
import { SearchResult } from '../types';
import TopicChip from './TopicChip';
import ResultCard from './ResultCard';

const TOPICS = [
  'Strength',
  'Hypertrophy',
  'Nutrition',
  'Recovery',
  'Creatine',
  'Cardio',
  'Carbohydrates',
];

function SearchSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="h-4 bg-gray-100 rounded-full w-40 animate-pulse" />
        <div className="h-6 bg-gray-100 rounded-full w-32 animate-pulse flex-shrink-0" />
      </div>
      <div className="space-y-2 mb-6">
        <div className="h-3 bg-gray-100 rounded-full animate-pulse" />
        <div className="h-3 bg-gray-100 rounded-full w-5/6 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded-full w-4/6 animate-pulse" />
      </div>
      <div className="space-y-2 mb-6">
        <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
        <div className="h-16 bg-gray-50 rounded-xl animate-pulse" />
      </div>
      <div className="flex gap-2">
        <div className="h-7 bg-gray-100 rounded-full w-48 animate-pulse" />
        <div className="h-7 bg-gray-100 rounded-full w-36 animate-pulse" />
      </div>
    </div>
  );
}

export default function SearchPanel() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);

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

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setActiveChip(null);
      search(query);
    }
  };

  const handleChipClick = (topic: string) => {
    if (activeChip === topic) {
      setActiveChip(null);
      setQuery('');
      return;
    }
    setActiveChip(topic);
    setQuery(topic);
    search(topic);
  };

  const handleSearchClick = () => {
    setActiveChip(null);
    search(query);
  };

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
            <path
              d="M6.5 11.5A5 5 0 1 0 6.5 1.5a5 5 0 0 0 0 10ZM13 13l-2.5-2.5"
              stroke="#9CA3AF"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search any lifting topic…"
          className="w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10 transition-all duration-200 shadow-sm"
        />
        <button
          onClick={handleSearchClick}
          disabled={loading || !query.trim()}
          className="absolute inset-y-0 right-0 flex items-center px-3"
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

      {/* Loading skeleton */}
      {loading && <SearchSkeleton />}

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
      {result && !loading && <ResultCard result={result} />}

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
