type HeaderProps = {
  subtitle?: string;
  onHome?: () => void;
  userName?: string;
  onSignOut?: () => void;
};

export default function Header({ subtitle = 'GC Rating System', onHome, userName, onSignOut }: HeaderProps) {
  const title = 'Legacy Mechanical';
  return (
    <header className="h-16 w-full shrink-0 bg-legacy-blue-dark">
      <div className="flex h-full items-center justify-between px-6">
        <div className="flex items-baseline gap-3">
          {onHome ? (
            <button
              onClick={onHome}
              className="text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
            >
              {title}
            </button>
          ) : (
            <h1 className="text-lg font-semibold tracking-tight text-white">{title}</h1>
          )}
          {subtitle && <span className="text-sm text-white/70">{subtitle}</span>}
        </div>
        {onSignOut && (
          <div className="flex items-center gap-3">
            {userName && <span className="text-sm text-white/80">{userName}</span>}
            <button
              onClick={onSignOut}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-white/70 transition hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
