import { FrictionBar, PrizeBar } from "./FrictionBar.jsx";
import { Badge, CountryMark } from "./ui.jsx";
import { ConfidenceBadge } from "./Confidence.jsx";
import { EASE_COLOR, PRIZE_COLOR, agreementShort, ease, pct, viewScore } from "../lib/format.js";

/**
 * Compact ranked list. Every number reads "higher is better", and the bar under each row shows where
 * that number comes from: ease points per factor (Easiest), prize points per part (Biggest prize), or
 * prize and ease side by side (Recommended, which blends the two). Click a row to open that market;
 * click an ease segment to open that factor.
 */
export function MarketList({ markets, kind, selected, onSelect, onFactor, view = "friction", weights }) {
  return (
    <ul className="space-y-1.5" aria-label="Ranked markets">
      {markets.map((m, i) => {
        const blocked = m.status === "blocked";
        const isSel = selected === m.country_code;
        const score = blocked ? null : viewScore(m, view);
        return (
          <li key={m.country_code} className="rise" style={{ animationDelay: `${180 + i * 70}ms` }}>
            <button
              type="button"
              onClick={() => onSelect(m.country_code)}
              aria-pressed={isSel}
              className={`group relative w-full rounded-xl border px-3.5 py-2.5 text-left transition-all duration-150 ${
                isSel
                  ? "border-neutral-900 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
                  : "border-neutral-200/80 bg-white hover:border-neutral-300 hover:shadow-sm"
              } ${blocked ? "bg-neutral-50/60" : ""}`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-5 text-center text-xs tabular-nums ${isSel ? "text-neutral-900" : "text-neutral-400"}`}>
                  {blocked ? "–" : m.rank}
                </span>
                <CountryMark code={m.country_code} muted={blocked} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${blocked ? "text-neutral-500" : "text-neutral-900"}`}>{m.country}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
                    {blocked ? (
                      <Badge tone="danger">Not accessible</Badge>
                    ) : (
                      <>
                        {kind === "goods" && (
                          <span className={m.entry.tariff_rate > 0 ? "font-semibold text-neutral-900" : ""}>{pct(m.entry.tariff_rate)} tariff</span>
                        )}
                        {m.entry.trade_agreement && (
                          <>
                            {kind === "goods" && <span className="text-neutral-300">·</span>}
                            <span>{agreementShort(m.entry.trade_agreement)}</span>
                          </>
                        )}
                      </>
                    )}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-xl font-semibold leading-none tabular-nums tracking-tight">
                    {score == null ? "—" : score.toFixed(0)}
                  </span>
                </span>
              </div>
              {blocked ? (
                <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note}</p>
              ) : m.score == null ? (
                <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note || "Not scored: data unavailable."}</p>
              ) : (
                <ScoreBreakdown market={m} view={view} weights={weights} onFactor={onFactor} />
              )}
              <div className="mt-2 pl-[4.25rem]">
                <ConfidenceBadge level={m.entry.compliance_confidence ?? "verified"} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The bar under a row, matching the view's number. */
function ScoreBreakdown({ market, view, weights, onFactor }) {
  if (view === "overall" && market.overall != null && market.opportunity != null) {
    return (
      <div className="mt-2.5 grid grid-cols-2 gap-3 pl-[4.25rem]">
        <MiniMeter label="Prize" value={market.opportunity} color={PRIZE_COLOR} />
        <MiniMeter label="Ease" value={ease(market)} color={EASE_COLOR} />
      </div>
    );
  }
  if (view === "opportunity" && market.opportunity != null) {
    return (
      <div className="mt-2.5 flex items-center gap-2 pl-[4.25rem]">
        <PrizeBar market={market} thin />
      </div>
    );
  }
  return (
    <div className="mt-2.5 flex items-center gap-2 pl-[4.25rem]">
      <FrictionBar market={market} weights={weights} thin onSegment={onFactor} />
    </div>
  );
}

function MiniMeter({ label, value, color }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500" title={`${label} ${v.toFixed(0)} of 100`}>
      <span className="w-8 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <span className="block h-full rounded-full" style={{ width: `${v}%`, background: color }} />
      </span>
      <span className="w-5 text-right tabular-nums text-neutral-700">{v.toFixed(0)}</span>
    </div>
  );
}
