export type Mode = 'studies' | 'keenan';

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

const OPTIONS: Array<{ value: Mode; label: string }> = [
  { value: 'studies', label: 'Research' },
  { value: 'keenan', label: 'Keenan Wiki' },
];

// A segmented control rather than routes: there is no router in this app, and
// the production build is served from GitHub Pages under /SimpleBL/, where a
// path-based route would 404 on refresh.
export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Answer source"
      className="inline-flex p-0.5 rounded-xl bg-gray-100 border border-gray-200"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`px-3.5 py-1.5 rounded-[10px] text-xs font-semibold transition-all duration-200 ${
              active
                ? 'bg-white text-brand-green-dark shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
