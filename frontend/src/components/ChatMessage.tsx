import { ReactNode } from 'react';
import { ChatMessage as ChatMessageType } from '../types';

interface ChatMessageProps {
  message: ChatMessageType;
}

// Parse inline markdown citation links [text](url) into styled pill links
function parseContent(text: string): ReactNode[] {
  const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = linkPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={lastIndex}>{text.slice(lastIndex, match.index)}</span>);
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-green-light text-brand-green-dark text-xs font-medium hover:opacity-75 transition-opacity mx-0.5"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(<span key={lastIndex}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}

function BotIcon() {
  return (
    <div className="w-7 h-7 rounded-lg bg-brand-green flex items-center justify-center flex-shrink-0">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <rect x="2" y="5.5" width="1.75" height="1.75" rx="0.4" fill="white" fillOpacity="0.9" />
        <rect x="10.25" y="5.5" width="1.75" height="1.75" rx="0.4" fill="white" fillOpacity="0.9" />
        <rect x="3.75" y="4.5" width="1.25" height="5" rx="0.4" fill="white" fillOpacity="0.9" />
        <rect x="9" y="4.5" width="1.25" height="5" rx="0.4" fill="white" fillOpacity="0.9" />
        <rect x="5" y="6.25" width="4" height="1.5" rx="0.4" fill="white" fillOpacity="0.9" />
      </svg>
    </div>
  );
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-2 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <BotIcon />}
      <div
        className={`max-w-[82%] px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? 'bg-brand-green text-white rounded-2xl rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-700 rounded-2xl rounded-tl-sm shadow-sm'
        }`}
      >
        {isUser ? message.content : parseContent(message.content)}
      </div>
    </div>
  );
}
