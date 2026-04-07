import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { ChatMessage as ChatMessageType } from '../types';
import ChatMessage from './ChatMessage';

const INTRO: ChatMessageType = {
  role: 'assistant',
  content:
    "Hey! I'm SimpleBL, your evidence-based fitness assistant. Ask me anything about training, nutrition, recovery, or supplementation — I'll give you research-grounded answers and flag where the science is still debated.",
};

function TypingIndicator() {
  return (
    <div className="flex items-start gap-2 animate-fade-in">
      <div className="w-7 h-7 rounded-lg bg-brand-green flex items-center justify-center flex-shrink-0">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect x="2" y="5.5" width="1.75" height="1.75" rx="0.4" fill="white" fillOpacity="0.9" />
          <rect x="10.25" y="5.5" width="1.75" height="1.75" rx="0.4" fill="white" fillOpacity="0.9" />
          <rect x="3.75" y="4.5" width="1.25" height="5" rx="0.4" fill="white" fillOpacity="0.9" />
          <rect x="9" y="4.5" width="1.25" height="5" rx="0.4" fill="white" fillOpacity="0.9" />
          <rect x="5" y="6.25" width="4" height="1.5" rx="0.4" fill="white" fillOpacity="0.9" />
        </svg>
      </div>
      <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5 h-4">
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '900ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '180ms', animationDuration: '900ms' }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: '360ms', animationDuration: '900ms' }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessageType[]>([INTRO]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessageType = { role: 'user', content: trimmed };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      // Exclude the static intro message from API history
      const apiMessages = updated.filter(
        (m) => !(m.role === 'assistant' && m.content === INTRO.content)
      );

      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        throw new Error('Request failed');
      }

      const data = (await res.json()) as { reply: string };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className="flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
      style={{ height: 'calc(100vh - 290px)', minHeight: '420px' }}
    >
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <ChatMessage key={i} message={msg} />
        ))}
        {loading && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 px-3 py-2 focus-within:border-brand-green focus-within:ring-2 focus-within:ring-brand-green/10 transition-all duration-200">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about training or nutrition…"
            disabled={loading}
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className={`p-1.5 rounded-lg transition-all duration-200 flex-shrink-0 ${
              loading || !input.trim()
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-brand-green hover:bg-brand-green-light'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M14 2L8 14L6.5 9.5L2 8L14 2Z"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinejoin="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
