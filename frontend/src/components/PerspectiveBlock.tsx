import { Perspective } from '../types';

interface PerspectiveBlockProps {
  perspective: Perspective;
}

export default function PerspectiveBlock({ perspective }: PerspectiveBlockProps) {
  const isFor = perspective.side === 'for';

  return (
    <div
      className={`rounded-xl p-4 border-l-[3px] ${
        isFor
          ? 'bg-brand-green-light border-brand-green'
          : 'bg-brand-coral-light border-brand-coral'
      }`}
    >
      <div
        className={`text-[10px] font-semibold font-mono uppercase tracking-widest mb-2 ${
          isFor ? 'text-brand-green-dark' : 'text-brand-coral-dark'
        }`}
      >
        {perspective.label}
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{perspective.text}</p>
    </div>
  );
}
