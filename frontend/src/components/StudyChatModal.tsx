import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { ChatMessage, Study } from '../types';

interface StudyChatModalProps {
  study: Study;
  messages: ChatMessage[];
  loading: boolean;
  fullTextAvailable: boolean | null;
  onSend: (question: string) => void;
  onClose: () => void;
}

export default function StudyChatModal({
  study,
  messages,
  loading,
  fullTextAvailable,
  onSend,
  onClose,
}: StudyChatModalProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-xl border border-gray-200 shadow-lg flex flex-col h-[85vh] sm:h-[600px] animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 line-clamp-2">{study.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <a
                href={study.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-green hover:underline"
              >
                View on PubMed
              </a>
              {fullTextAvailable !== null && (
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    fullTextAvailable
                      ? 'bg-brand-green-light text-brand-green-dark'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {fullTextAvailable ? 'Full text available' : 'Abstract only'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3">
              Ask me anything about this study. I'll answer from{' '}
              {fullTextAvailable ? 'the full paper' : 'its abstract'} — and say so if
              something isn't covered.
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'ml-auto bg-brand-green text-white'
                  : 'bg-gray-50 text-gray-700'
              }`}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="bg-gray-50 text-gray-400 rounded-lg px-3 py-2 text-sm w-fit">
              Thinking…
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-gray-100 flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this study…"
            rows={1}
            className="flex-1 resize-none px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:border-brand-green focus:ring-2 focus:ring-brand-green/10"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              loading || !input.trim()
                ? 'bg-gray-100 text-gray-300'
                : 'bg-brand-green text-white hover:opacity-90'
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
