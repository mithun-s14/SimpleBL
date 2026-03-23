import { Study } from '../types';

interface StudyLinkProps {
  study: Study;
}

export default function StudyLink({ study }: StudyLinkProps) {
  return (
    <a
      href={study.url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-50 text-gray-500 text-xs border border-gray-200 hover:bg-brand-green-light hover:text-brand-green-dark hover:border-brand-green/20 transition-all duration-200"
    >
      <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M1 8L8 1M8 1H3.5M8 1V5.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="line-clamp-1">{study.title}</span>
    </a>
  );
}
