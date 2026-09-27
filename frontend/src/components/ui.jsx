// Shared UI primitives (dependency-free on purpose).
import { useEffect, useRef, useState } from "react";

/** Starts at 0 and moves to the real value after mount, so rings and meters animate in. */
function useGrowIn(value) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setV(value ?? 0), 60);
    return () => clearTimeout(t);
  }, [value]);
  return v;
}

export function Button({ variant = "primary", size = "md", className = "", ...props }) {
  const base =
    "inline-flex select-none items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-40";
  const variants = {
    primary:
      "bg-brand text-white shadow-[0_1px_2px_color-mix(in_srgb,var(--color-brand)_35%,transparent),0_4px_14px_-6px_color-mix(in_srgb,var(--color-brand)_60%,transparent),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-brand-600",
    outline: "border border-neutral-200 bg-white text-neutral-900 shadow-sm hover:border-neutral-300 hover:bg-neutral-50",
    ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
    soft: "bg-neutral-100 text-neutral-900 hover:bg-neutral-200/70",
  };
  const sizes = { xs: "h-7 px-2.5 text-xs", sm: "h-8 px-3 text-sm", md: "h-10 px-4 text-sm", lg: "h-11 px-5 text-[15px]" };
  return <button className={`${base} ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}

export function Badge({ tone = "neutral", className = "", children }) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700",
    accent: "bg-accent-soft text-accent",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
    outline: "border border-neutral-200 text-neutral-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}

/** Pill-shaped segmented control. options: [{ key, label, title? }] */
export function Segmented({ options, value, onChange, label, size = "md", role = "radiogroup", itemRole = "radio", stretch = false }) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div role={role} aria-label={label} className={`${stretch ? "flex w-full" : "inline-flex"} rounded-lg bg-neutral-900/[0.04] p-0.5 ring-1 ring-inset ring-neutral-900/[0.06]`}>
      {options.map((o) => {
        const active = value === o.key;
        return (
          <button
            key={o.key}
            type="button"
            role={itemRole}
            aria-checked={itemRole === "radio" ? active : undefined}
            aria-selected={itemRole === "tab" ? active : undefined}
            title={o.title}
            onClick={() => onChange(o.key)}
            className={`rounded-md font-medium whitespace-nowrap transition-all duration-150 ${stretch ? "flex-1" : ""} ${pad} ${
              active ? "bg-white text-brand shadow-[0_1px_2px_color-mix(in_srgb,var(--color-brand)_15%,transparent),0_0_0_1px_color-mix(in_srgb,var(--color-brand)_14%,transparent)]" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Styled range input with a coloured fill up to the thumb. */
export function Slider({ value, onChange, min = 0, max = 1, step = 0.05, color = "#171717", label, className = "" }) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`slider ${className}`}
      style={{ "--fill": `${fill}%`, "--c": color }}
    />
  );
}

/** Circular 0-100 gauge with the value in the middle. */
export function ScoreRing({ value, label, color = "#171717", size = 64, hint }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const v = useGrowIn(value == null ? 0 : Math.max(0, Math.min(100, value)));
  return (
    <div className="flex flex-col items-center gap-1" title={hint}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f0f0f0" strokeWidth="6" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v / 100)}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-base font-semibold tabular-nums">
          {value == null ? "–" : Math.round(value)}
        </span>
      </div>
      <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
    </div>
  );
}

/** Thin 0-1 bar. */
export function Meter({ value, color = "#171717", className = "" }) {
  const v = useGrowIn(Math.max(0, Math.min(1, value ?? 0)));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-neutral-100 ${className}`}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${v * 100}%`, background: color, transitionDuration: "800ms" }} />
    </div>
  );
}

/** Closes on outside click and Escape. */
export function useDismiss(open, onClose) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && onClose();
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return ref;
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

export function Icon({ name, className = "h-4 w-4" }) {
  const paths = {
    close: "M6 6l12 12M18 6L6 18",
    sliders: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
    list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    map: "M4 20V4M4 20h16M8 14l3-3 3 2 5-6",
    back: "M15 18l-6-6 6-6",
    chevron: "M9 6l6 6-6 6",
    search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35",
    clock: "M12 7v5l3 2M12 21a9 9 0 100-18 9 9 0 000 18z",
    ship: "M3 17l2 3h14l2-3M5 17V9h14v8M9 9V5h6v4",
    info: "M12 16v-4M12 8h.01M12 21a9 9 0 100-18 9 9 0 000 18z",
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}

/** Country code chip (emoji flags don't render on Windows). */
export function CountryMark({ code, size = "sm", muted = false }) {
  const sz = size === "lg" ? "h-8 min-w-10 text-sm" : "h-6 min-w-8 text-[11px]";
  return (
    <span
      aria-hidden
      className={`inline-grid place-items-center rounded-md px-1.5 font-semibold tracking-wide ${sz} ${
        muted ? "bg-neutral-100 text-neutral-400" : "bg-neutral-900 text-white"
      }`}
    >
      {code}
    </span>
  );
}

/**
 * When `trigger` changes to a truthy value: scroll the returned `ref` element into view (smoothly, near the
 * top, with the element's scroll-margin as offset), flash a soft accent-coloured glow that fades, and move
 * keyboard focus to `focusRef` without another scroll jump. Reduced motion: instant scroll, no glow.
 */
export function useReveal(trigger) {
  const ref = useRef(null);
  const focusRef = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!trigger || !el) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const id = requestAnimationFrame(() => {
      el.scrollIntoView?.({ behavior: reduce ? "auto" : "smooth", block: "start" });
      if (!reduce) {
        el.classList.remove("reveal-flash");
        void el.offsetWidth; // restart the animation
        el.classList.add("reveal-flash");
      }
      (focusRef.current ?? el).focus?.({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [trigger]);
  return [ref, focusRef];
}
