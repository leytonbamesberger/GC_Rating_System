type HeaderProps = {
  subtitle?: string;
  onHome?: () => void;
  userName?: string;
  onSignOut?: () => void;
};

export default function Header({ subtitle = 'GC Rating System', onHome, userName, onSignOut }: HeaderProps) {
  return (
    <header className="w-full bg-navy-900 border-b border-white/10 px-6 py-5">
      <div className="max-w-6xl mx-auto flex items-start justify-between gap-4">
        <div>
          <div className="inline-block">
            {onHome ? (
              <button
                onClick={onHome}
                className="text-2xl font-bold text-white tracking-tight leading-none hover:text-white/80 transition-colors text-left"
              >
                Legacy Mechanical
              </button>
            ) : (
              <h1 className="text-2xl font-bold text-white tracking-tight leading-none">
                Legacy Mechanical
              </h1>
            )}
            <div className="h-0.5 bg-brand-500 mt-1 w-full" />
          </div>
          {subtitle && (
            <p className="text-sm text-white/50 mt-1 font-medium tracking-widest uppercase">
              {subtitle}
            </p>
          )}
        </div>
        {onSignOut && (
          <div className="text-right flex-shrink-0">
            {userName && <p className="text-sm text-white/70">{userName}</p>}
            <button
              onClick={onSignOut}
              className="text-xs text-white/40 hover:text-white transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
