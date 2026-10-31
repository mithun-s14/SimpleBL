import { useState } from 'react';
import { ChatMessage } from './types';

// Per-PMID chat history; mode 'debate' makes the backend critique and push back
export function useStudyChat(mode?: 'debate') {
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>({});
  const [fullText, setFullText] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const send = async (pmid: string, question: string) => {
    const nextMessages: ChatMessage[] = [...(chats[pmid] ?? []), { role: 'user', content: question }];
    setChats((prev) => ({ ...prev, [pmid]: nextMessages }));
    setLoading(true);

    let reply: string;
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
      const res = await fetch(`${apiBase}/api/study/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pmid, messages: nextMessages, mode }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? 'Could not get a response.');
      }
      const data = (await res.json()) as { reply: string; fullTextAvailable: boolean };
      setFullText((prev) => ({ ...prev, [pmid]: data.fullTextAvailable }));
      reply = data.reply;
    } catch (err) {
      reply = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
    } finally {
      setLoading(false);
    }
    setChats((prev) => ({ ...prev, [pmid]: [...nextMessages, { role: 'assistant', content: reply }] }));
  };

  return { chats, fullText, loading, send };
}
