// Small shared UI primitives (kept dependency-free on purpose).

export function Button({ variant = "primary", size = "md", className = "", ...props }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:cursor-not-allowed disabled:opacity-50";
  const variants = {
    primary: "bg-neutral-900 text-white hover:bg-neutral-700",
    outline: "border border-neutral-200 bg-white text-neutral-900 hover:bg-neutral-50",
    ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
  };
  const sizes = { sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-base" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function Badge({ tone = "neutral", className = "", children }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700",
    accent: "bg-accent-soft text-accent",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function Spinner({ className = "" }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

export function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-neutral-100 ${className}`} />;
}

export function ErrorNote({ children }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </p>
  );
}

export function ExternalLink({ href, children, className = "" }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`underline-offset-2 hover:underline ${className}`}>
      {children}
    </a>
  );
}
