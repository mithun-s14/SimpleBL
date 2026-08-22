import { Study } from '../types';

interface StudyLinkProps {
  study: Study;
  onAsk: (study: Study) => void;
}

export default function StudyLink({ study, onAsk }: StudyLinkProps) {
  return (
    <button
      type="button"
      onClick={() => onAsk(study)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs text-left border border-gray-200 hover:bg-brand-green-light hover:text-brand-green-dark hover:border-brand-green/20 transition-all duration-200"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="0.5" y="1" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1" />
        <path d="M3 8.5L4.2 7H3z" fill="currentColor" />
      </svg>
      <span className="line-clamp-1">{study.title}</span>
      <a
        href={study.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="Open on PubMed"
        className="flex-shrink-0 opacity-60 hover:opacity-100"
      >
        <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 8L8 1M8 1H3.5M8 1V5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </a>
    </button>
  );
}
