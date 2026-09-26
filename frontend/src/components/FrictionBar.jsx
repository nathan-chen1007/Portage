import { useState } from "react";
import { COMPONENTS } from "../lib/format.js";

/** Stacked bar: each blocker's weighted share of the 0-100 friction score. Blocked markets render nothing. */
export function FrictionBar({ market, max = 100 }) {
  const [hover, setHover] = useState(null);
  if (market.status === "blocked" || market.score === null) return null;

  const parts = COMPONENTS.filter((c) => (market.breakdown?.[c.key] ?? 0) > 0);
  const summary = parts.map((c) => `${c.label} ${market.breakdown[c.key].toFixed(1)}`).join(", ");

  return (
    <div className="relative w-full" aria-label={`Friction ${market.score.toFixed(1)}: ${summary || "no barriers"}`}>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-neutral-100">
        {parts.map((c, i) => (
          <div
            key={c.key}
            data-testid={`seg-${c.key}`}
            className="seg h-full transition-opacity"
            onMouseEnter={() => setHover(c.key)}
            onMouseLeave={() => setHover(null)}
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
      {hover && (
        <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm">
          {COMPONENTS.find((c) => c.key === hover).label}: {market.breakdown[hover].toFixed(1)} of {market.score.toFixed(1)} points
        </div>
      )}
    </div>
  );
}

export function FrictionLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
      {COMPONENTS.map((c) => (
        <span key={c.key} className="flex items-center gap-1.5" title={c.help}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
          {c.label}
        </span>
      ))}
    </div>
  );
}
