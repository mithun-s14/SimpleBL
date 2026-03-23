interface TopicChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export default function TopicChip({ label, active, onClick }: TopicChipProps) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
        active
          ? 'bg-brand-green-light text-brand-green-dark border-brand-green/30 shadow-sm'
          : 'bg-white text-gray-500 border-gray-200 hover:border-brand-green/30 hover:text-brand-green hover:bg-brand-green-light/50'
      }`}
    >
      {label}
    </button>
  );
}
