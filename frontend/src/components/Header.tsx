interface HeaderProps {
  email: string | null;
  onLogin: () => void;
  onLogout: () => void;
}

export default function Header({ email, onLogin, onLogout }: HeaderProps) {
  return (
    <header className="mb-8 text-center">
      <div className="flex justify-end gap-3 mb-4 text-xs">
        {email ? (
          <>
            <span className="text-gray-400 truncate">{email}</span>
            <button onClick={onLogout} className="text-gray-500 hover:text-gray-900">
              Log out
            </button>
          </>
        ) : (
          <button onClick={onLogin} className="text-brand-green font-medium hover:underline">
            Log in / Sign up
          </button>
        )}
      </div>
      <div className="flex items-center justify-center gap-2.5 mb-2">
        {/* Logo mark */}
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-sm flex items-center justify-center">
          <img src={`${import.meta.env.BASE_URL}simplebl_logo.png`} alt="SimpleBL logo" className="w-full h-full object-contain" />
        </div>
        <h1 className="text-[22px] font-bold tracking-tight text-gray-900">SimpleBL</h1>
      </div>
      <p className="text-xs font-mono text-gray-400 tracking-wide">
        evidence-based answers for lifters
      </p>
    </header>
  );
}
