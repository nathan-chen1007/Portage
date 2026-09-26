import { useState } from "react";
import { COMPONENTS, PRIZE_PARTS, earned } from "../lib/format.js";

/**
 * Stacked bar out of 100 where each coloured segment is the ease points a factor EARNS
 * (its weight minus what it costs). A longer bar means an easier market; the grey gap is
 * points lost. Blocked markets render nothing.
 */
export function FrictionBar({ market, weights, thin = false, onSegment }) {
  const [hover, setHover] = useState(null);
  if (market.status === "blocked" || market.score === null) return null;

  const parts = COMPONENTS.map((c) => ({ ...c, ...earned(market, c.key, weights) }));
  const total = parts.reduce((a, p) => a + p.points, 0);
  const summary = parts.map((p) => `${p.label} ${p.points.toFixed(0)} of ${p.max.toFixed(0)}`).join(", ");
  const h = hover && parts.find((p) => p.key === hover);

  return (
    <div className="relative w-full" aria-label={`Ease ${total.toFixed(0)} of 100: ${summary}`}>
      <Track thin={thin}>
        {parts
          .filter((p) => p.points > 0.05)
          .map((p) => (
            <div
              key={p.key}
              data-testid={`seg-${p.key}`}
              title={`${p.label}: ${p.points.toFixed(0)} of ${p.max.toFixed(0)} points`}
              className={`seg h-full transition-opacity ${onSegment ? "cursor-pointer" : ""}`}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
              onClick={
                onSegment
                  ? (e) => {
                      e.stopPropagation();
                      onSegment(p.key);
                    }
                  : undefined
              }
              style={{ width: `${p.points}%`, background: p.color, opacity: hover && hover !== p.key ? 0.35 : 1 }}
            />
          ))}
      </Track>
      {h && !thin && (
        <div className="pointer-events-none absolute -top-9 left-0 z-10 whitespace-nowrap rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-neutral-700 shadow-sm">
          {h.label}: {h.points.toFixed(0)} of {h.max.toFixed(0)} points
        </div>
      )}
    </div>
  );
}

/** Same idea for the prize: each segment is the points a part of the opportunity score earns. */
export function PrizeBar({ market, thin = false }) {
  const oc = market.opportunity_components;
  if (market.status === "blocked" || market.opportunity == null || !oc) return null;
  // An unavailable input (null) is dropped and the others re-weighted, exactly as the backend scores it.
  const avail = PRIZE_PARTS.filter((p) => oc[p.key] != null);
  const total = avail.reduce((s, p) => s + p.weight, 0) || 1;
  const parts = avail.map((p) => ({ ...p, points: (100 * p.weight * oc[p.key]) / total, max: (100 * p.weight) / total }));
  const missing = PRIZE_PARTS.filter((p) => p.key in oc && oc[p.key] == null).map((p) => `${p.short} data unavailable`);
  const summary = [...parts.map((p) => `${p.label} ${p.points.toFixed(0)} of ${p.max.toFixed(0)}`), ...missing].join(", ");
  return (
    <div className="w-full" aria-label={`Opportunity ${market.opportunity.toFixed(0)} of 100: ${summary}`}>
      <Track thin={thin}>
        {parts
          .filter((p) => p.points > 0.05)
          .map((p) => (
            <div
              key={p.key}
              data-testid={`prize-${p.key}`}
              title={`${p.label}: ${p.points.toFixed(0)} of ${p.max.toFixed(0)} points`}
              className="seg h-full"
              style={{ width: `${p.points}%`, background: p.color }}
            />
          ))}
      </Track>
      {missing.length > 0 && (
        <p className="mt-1 text-[11px] leading-tight text-neutral-400" data-testid="prize-unavailable">
          {missing.join(" · ")} (left out, the rest re-weighted)
        </p>
      )}
    </div>
  );
}

function Track({ thin, children }) {
  return <div className={`flex w-full overflow-hidden rounded-full bg-neutral-100 ${thin ? "h-1.5" : "h-2.5"}`}>{children}</div>;
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
