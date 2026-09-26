/** Shared brand pieces used by the marketing site and the workspace top bar. */

export function Logo({ className = "" }) {
  return (
    <span className={`flex items-center gap-2 text-[17px] font-semibold tracking-tight ${className}`}>
      <img src="/favicon.svg" alt="" className="h-7 w-7 rounded-lg shadow-[0_2px_8px_rgba(0,0,0,0.18)]" />
      Portage
    </span>
  );
}

export function HealthPill({ health }) {
  if (health === "checking") return <span className="text-xs text-neutral-400">Connecting…</span>;
  const ok = health === "ok";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
      <span className="relative flex h-2 w-2">
        {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-red-500"}`} />
      </span>
      {ok ? "Live data" : "Backend offline"}
    </span>
  );
}

export function Arrow({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 10h12M11 5l5 5-5 5" />
    </svg>
  );
}

/** Small mono eyebrow label above section titles. */
export function Eyebrow({ children, className = "text-accent" }) {
  return <p className={`font-mono text-[11px] font-medium uppercase tracking-[0.2em] ${className}`}>{children}</p>;
}
