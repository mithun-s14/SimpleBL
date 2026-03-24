export default function Header() {
  return (
    <header className="mb-8 text-center">
      <div className="flex items-center justify-center gap-2.5 mb-2">
        {/* Logo mark */}
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
          <img src="/simplebl_logo.png" alt="SimpleBL logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-gray-900">SimpleBL</h1>
      </div>
      <p className="text-xs font-mono text-gray-400 tracking-wide">
        evidence-based answers for lifters
      </p>
    </header>
  );
}
