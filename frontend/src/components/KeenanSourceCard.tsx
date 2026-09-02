import { KeenanSource } from '../types';

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

interface KeenanSourceCardProps {
  source: KeenanSource;
  index: number;
}

// Links straight to the moment in the video. The excerpt is deliberately short:
// this should point at his work, not stand in for it.
export default function KeenanSourceCard({ source, index }: KeenanSourceCardProps) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 p-2.5 rounded-xl border border-gray-200 bg-white hover:border-brand-green/30 hover:bg-brand-green-light/30 transition-all duration-200"
    >
      <div className="relative flex-shrink-0 w-24 h-[54px] rounded-lg overflow-hidden bg-gray-100">
        <img
          src={`https://i.ytimg.com/vi/${source.videoId}/mqdefault.jpg`}
          alt=""
          loading="lazy"
          className="w-full h-full object-cover"
        />
        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/75 text-white text-[10px] font-mono leading-none">
          {formatTimestamp(source.startSeconds)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[11px] text-brand-green flex-shrink-0">[{index}]</span>
          <h4 className="text-xs font-semibold text-gray-900 line-clamp-1 group-hover:text-brand-green-dark transition-colors duration-200">
            {source.title}
          </h4>
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400 line-clamp-2 leading-snug">
          {source.excerpt}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-gray-400 tracking-wide">
          {formatDate(source.publishedAt)}
        </p>
      </div>

      <svg
        width="9"
        height="9"
        viewBox="0 0 9 9"
        fill="none"
        className="flex-shrink-0 mt-1 text-gray-300 group-hover:text-brand-green transition-colors duration-200"
      >
        <path
          d="M1 8L8 1M8 1H3.5M8 1V5.5"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </a>
  );
}
