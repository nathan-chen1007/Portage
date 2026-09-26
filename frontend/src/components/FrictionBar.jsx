import { useState } from "react";
import { COMPONENTS } from "../lib/format.js";

/** Stacked bar: each blocker's weighted share of the 0-100 friction score. Blocked markets render nothing. */
export function FrictionBar({ market, max = 100, thin = false, onSegment }) {
  const [hover, setHover] = useState(null);
  if (market.status === "blocked" || market.score === null) return null;

  const parts = COMPONENTS.filter((c) => (market.breakdown?.[c.key] ?? 0) > 0);
  const summary = parts.map((c) => `${c.label} ${market.breakdown[c.key].toFixed(1)}`).join(", ");
  const h = hover && COMPONENTS.find((c) => c.key === hover);

  return (
    <div className="relative w-full" aria-label={`Friction ${market.score.toFixed(1)}: ${summary || "no barriers"}`}>
      <div className={`flex w-full overflow-hidden rounded-full bg-neutral-100 ${thin ? "h-1.5" : "h-2.5"}`}>
        {parts.map((c, i) => (
          <div
            key={c.key}
            data-testid={`seg-${c.key}`}
            className={`seg h-full transition-opacity ${onSegment ? "cursor-pointer" : ""}`}
            onMouseEnter={() => setHover(c.key)}
            onMouseLeave={() => setHover(null)}
            onClick={
              onSegment
                ? (e) => {
                    e.stopPropagation();
                    onSegment(c.key);
                  }
                : undefined
            }
            style={{
              width: `${(market.breakdown[c.key] / max) * 100}%`,
              background: c.color,
              opacity: hover && hover !== c.key ? 0.35 : 1,
              borderTopRightRadius: i === parts.length - 1 ? 4 : 0,
              borderBottomRightRadius: i === parts.length - 1 ? 4 : 0,
            }}
          />
        ))}
      </div>
      {h && !thin && (
        <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm">
          {h.label}: {market.breakdown[hover].toFixed(1)} of {market.score.toFixed(1)} points
        </div>
      )}
    </div>
  );
}

/** Clickable legend: each chip opens that factor's panel. */
export function FactorChips({ active, onPick }) {
  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Explore a factor">
      {COMPONENTS.map((c) => {
        const on = active === c.key;
        return (
          <button
            key={c.key}
            type="button"
            title={c.help}
            aria-pressed={on}
            onClick={() => onPick(on ? null : c.key)}
            className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-all duration-150 ${
              on ? "border-transparent text-white shadow-sm" : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
            }`}
            style={on ? { background: c.color } : undefined}
          >
            {!on && <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />}
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
