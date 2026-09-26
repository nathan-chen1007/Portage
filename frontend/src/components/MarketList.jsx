import { FrictionBar } from "./FrictionBar.jsx";
import { Badge, CountryMark } from "./ui.jsx";
import { agreementShort, componentLabel, pct, viewScore } from "../lib/format.js";

const SCORE_LABEL = { overall: "score", friction: "friction", opportunity: "prize" };

/** Compact ranked list. Click a row to open that market's panel; click a bar segment to open that factor. */
export function MarketList({ markets, kind, selected, onSelect, onFactor, view = "friction" }) {
  return (
    <ul className="space-y-1.5" aria-label="Ranked markets">
      {markets.map((m) => {
        const blocked = m.status === "blocked";
        const isSel = selected === m.country_code;
        const score = blocked ? null : viewScore(m, view);
        return (
          <li key={m.country_code}>
            <button
              type="button"
              onClick={() => onSelect(m.country_code)}
              aria-pressed={isSel}
              className={`group relative w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-150 ${
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
                  {!blocked && <span className="text-[10px] uppercase tracking-wide text-neutral-400">{SCORE_LABEL[view] ?? "score"}</span>}
                </span>
              </div>
              {blocked ? (
                <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note}</p>
              ) : (
                <div className="mt-2.5 flex items-center gap-2 pl-[4.25rem]">
                  <FrictionBar market={m} thin onSegment={onFactor} />
                  <span className="w-16 shrink-0 text-right text-[11px] text-neutral-400">
                    {m.top_blocker ? componentLabel(m.top_blocker).toLowerCase() : "clear"}
                  </span>
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
