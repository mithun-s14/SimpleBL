import { useEffect, useRef, useState, ChangeEvent, KeyboardEvent } from 'react';
import { ThinkingOrb } from 'thinking-orbs';
import { KeenanAnswer, KeenanStats } from '../types';
import KeenanSourceCard from './KeenanSourceCard';
import TopicChip from './TopicChip';

const STARTERS = [
  'Is junk volume real?',
  'How many RIR should I leave?',
  'Lengthened partials?',
  'How do I find my TDEE?',
  'Training to failure?',
];

const CHANNEL_URL = 'https://www.youtube.com/@Keenanrmalloy';

function formatMonth(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function coverageLine(stats: KeenanStats): string {
  const from = formatMonth(stats.earliestPublishedAt);
  const to = formatMonth(stats.latestPublishedAt);
  const range = from && to ? (from === to ? ` from ${from}` : ` from ${from} to ${to}`) : '';
  return `Based on ${stats.videoCount} video${stats.videoCount === 1 ? '' : 's'}${range}`;
}

export default function KeenanPanel() {
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<KeenanAnswer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<KeenanStats | null>(null);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Corpus coverage doubles as a health check: if this fails the feature is
  // disabled or the corpus has not been built, and the line simply stays hidden.
  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
    fetch(`${apiBase}/api/keenan/stats`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setStats(data as KeenanStats | null))
      .catch(() => setStats(null));
  }, []);

  const ask = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/keenan/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q.trim() }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Could not get an answer.');
      }

      setResult((await res.json()) as KeenanAnswer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not get an answer. Please try again.');
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

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setQuestion(e.target.value);
    resizeTextarea();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      setActiveChip(null);
      ask(question);
    }
  };

  const handleChipClick = (starter: string) => {
    if (activeChip === starter) {
      setActiveChip(null);
      setQuestion('');
      requestAnimationFrame(resizeTextarea);
      return;
    }
    setActiveChip(starter);
    setQuestion(starter);
    ask(starter);
    requestAnimationFrame(resizeTextarea);
  };

  return (
    <div className="space-y-4">
      {/* Attribution: this is his work, and the page should say so up front. */}
      <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-200">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5 text-brand-coral">
          <path
            d="M21.6 7.2a2.8 2.8 0 0 0-2-2C17.9 4.8 12 4.8 12 4.8s-5.9 0-7.6.4a2.8 2.8 0 0 0-2 2A29 29 0 0 0 2 12a29 29 0 0 0 .4 4.8 2.8 2.8 0 0 0 2 2c1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4a2.8 2.8 0 0 0 2-2A29 29 0 0 0 22 12a29 29 0 0 0-.4-4.8Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path d="M10 15V9l5 3-5 3Z" fill="currentColor" />
        </svg>
        <div className="min-w-0">
          <p className="text-xs text-gray-600 leading-relaxed">
            Answers are drawn only from the transcripts of{' '}
            <a
              href={CHANNEL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-green-dark hover:underline"
            >
              Keenan Malloy
            </a>
            . They are machine-generated from automatic captions and can miss nuance — watch the
            linked moment before acting on anything.
          </p>
          {stats && stats.videoCount > 0 && (
            <p className="mt-1 font-mono text-[10px] text-gray-400 tracking-wide">
              {coverageLine(stats)}
            </p>
          )}
        </div>
      </div>

      {/* Question input */}
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
          value={question}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Ask what he's said about…"
          rows={1}
          maxLength={1000}
          className="w-full pl-10 pr-11 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10 transition-all duration-200 shadow-sm resize-none overflow-hidden leading-normal"
        />
        <button
          onClick={() => {
            setActiveChip(null);
            ask(question);
          }}
          disabled={loading || !question.trim()}
          className="absolute top-0 right-0 flex items-center px-3 h-11"
          aria-label="Ask"
        >
          <div
            className={`p-1.5 rounded-lg transition-colors duration-200 ${
              loading || !question.trim()
                ? 'text-gray-300'
                : 'text-brand-green hover:bg-brand-green-light'
            }`}
          >
            {loading ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 15 15" fill="none">
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

      {/* Starter questions */}
      <div className="flex flex-wrap gap-2">
        {STARTERS.map((starter) => (
          <TopicChip
            key={starter}
            label={starter}
            active={activeChip === starter}
            onClick={() => handleChipClick(starter)}
          />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <ThinkingOrb state="connecting" size={64} />
        </div>
      )}

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

      {/* A non-answer is rendered as a non-answer -- not dressed up as a result. */}
      {result && !loading && !result.sufficientContext && (
        <div className="bg-brand-amber-light border border-brand-amber-dark/15 rounded-2xl p-5 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 rounded-full bg-white/70 font-mono text-[10px] uppercase tracking-wider text-brand-amber-dark">
              Not covered
            </span>
          </div>
          <p className="text-sm text-brand-amber-dark leading-relaxed">{result.answer}</p>
          <p className="mt-3 text-xs text-brand-amber-dark/70">
            Try rephrasing, or ask about something closer to what he covers on the channel.
          </p>
        </div>
      )}

      {result && !loading && result.sufficientContext && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm animate-fade-in">
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
            {result.answer}
          </p>

          {result.sources.length > 0 && (
            <div className="mt-5 pt-4 border-t border-gray-100">
              <p className="font-mono text-[10px] uppercase tracking-wider text-gray-400 mb-2.5">
                Sources
              </p>
              <div className="space-y-2">
                {result.sources.map((source, i) => (
                  <KeenanSourceCard
                    key={`${source.videoId}-${source.startSeconds}`}
                    source={source}
                    index={i + 1}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-14 text-gray-400 animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <rect x="2.5" y="5" width="17" height="12" rx="2.5" stroke="#D1D5DB" strokeWidth="1.25" />
              <path d="M9.5 8.5L14 11l-4.5 2.5v-5Z" stroke="#D1D5DB" strokeWidth="1.25" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm">Ask a question or pick one above</p>
        </div>
      )}
    </div>
  );
}
