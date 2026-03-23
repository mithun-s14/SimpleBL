export default function Header() {
  return (
    <header className="mb-8 text-center">
      <div className="flex items-center justify-center gap-2.5 mb-2">
        {/* Logo mark */}
        <div className="w-9 h-9 rounded-xl bg-brand-green flex items-center justify-center shadow-sm">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Dumbbell-inspired icon */}
            <rect x="2" y="8.5" width="3" height="3" rx="0.75" fill="white" fillOpacity="0.9" />
            <rect x="15" y="8.5" width="3" height="3" rx="0.75" fill="white" fillOpacity="0.9" />
            <rect x="5" y="7" width="2" height="6" rx="0.75" fill="white" fillOpacity="0.9" />
            <rect x="13" y="7" width="2" height="6" rx="0.75" fill="white" fillOpacity="0.9" />
            <rect x="7" y="9.25" width="6" height="1.5" rx="0.75" fill="white" fillOpacity="0.9" />
          </svg>
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-gray-900">SimpleBL</h1>
      </div>
      <p className="text-xs font-mono text-gray-400 tracking-wide">
        evidence-based answers for lifters
      </p>
    </header>
  );
}
