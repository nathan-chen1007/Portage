import { FrictionBar, FrictionLegend } from "./FrictionBar.jsx";
import { Badge } from "./ui.jsx";
import { VIEWS, componentLabel, flag, pct, viewScore } from "../lib/format.js";

const HEADINGS = { overall: "Markets, best bet first", friction: "Markets, easiest first", opportunity: "Markets, biggest opportunity first" };

export function MarketList({ markets, kind, selected, onSelect, view = "friction" }) {
  const v = VIEWS.find((x) => x.key === view) ?? VIEWS[1];
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{HEADINGS[view] ?? HEADINGS.friction}</h2>
          <p className="text-sm text-neutral-500">{v.help}</p>
        </div>
        <FrictionLegend />
      </div>

      <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
        {markets.map((m) => {
          const blocked = m.status === "blocked";
          const isSel = selected === m.country_code;
          return (
            <li key={m.country_code}>
              <button
                type="button"
                onClick={() => onSelect(m.country_code)}
                aria-pressed={isSel}
                className={`grid w-full grid-cols-[1.75rem_1fr_3.5rem] items-center gap-4 px-4 py-3.5 text-left transition-colors sm:grid-cols-[1.75rem_13rem_1fr_3.5rem] ${
                  isSel ? "bg-neutral-50" : "hover:bg-neutral-50/70"
                } ${blocked ? "text-neutral-400" : ""}`}
              >
                <span className="text-sm tabular-nums text-neutral-400">{blocked ? "–" : m.rank}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 font-medium">
                    <span aria-hidden>{flag(m.country_code)}</span>
                    <span className={`truncate ${blocked ? "text-neutral-500" : "text-neutral-900"}`}>{m.country}</span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
                    {blocked ? (
                      <Badge tone="danger">Not accessible</Badge>
                    ) : (
                      <>
                        {kind === "goods" && (
                          <span className={m.entry.tariff_rate > 0 ? "font-medium text-neutral-900" : ""}>
                            {pct(m.entry.tariff_rate)} tariff
                          </span>
                        )}
                        {m.entry.trade_agreement && <Badge>{m.entry.trade_agreement.split(" (")[0]}</Badge>}
                      </>
                    )}
                  </span>
                </span>
                <span className="hidden flex-col gap-1.5 sm:flex">
                  {blocked ? (
                    <span className="line-clamp-2 text-xs text-neutral-500">{m.status_note}</span>
                  ) : (
                    <>
                      <FrictionBar market={m} />
                      <span className="text-xs text-neutral-500">
                        {m.top_blocker ? `Biggest blocker: ${componentLabel(m.top_blocker).toLowerCase()}` : "No significant blockers"}
                        {m.opportunity != null && (
                          <span className="text-neutral-400">
                            {" "}· friction {m.score.toFixed(0)} · opportunity {m.opportunity.toFixed(0)}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                </span>
                <span className="text-right text-xl font-semibold tabular-nums tracking-tight">
                  {blocked ? "—" : viewScore(m, view).toFixed(0)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
