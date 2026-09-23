export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="10" className="fill-brand" />
      <path d="M11 28V12h3.2l9.6 10.4V12H27v16h-3.2L14.2 17.6V28z" className="fill-brand-fg" />
      <circle cx="30.5" cy="28" r="2.5" className="fill-brand-fg" opacity=".7" />
    </svg>
  );
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-extrabold tracking-tight">NOVOTIC</span>
          <span className="block text-[10px] font-bold tracking-[0.28em] text-muted">FLEET</span>
        </span>
      )}
    </span>
  );
}
