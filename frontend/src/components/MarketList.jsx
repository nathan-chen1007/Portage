import { Badge, CountryMark } from "./ui.jsx";
import { ConfidenceBadge } from "./Confidence.jsx";
import { HIGH_TARIFF, agreementLine, pct, scoreBounds, scoreTone, viewScore } from "../lib/format.js";

/**
 * Slim ranked list: rank, country, one score (the one the list is sorted by) and one line on the tariff and
 * trade deal. High tariffs read red with the reason. The compliance badge only shows when the data isn't verified.
 */
export function MarketList({ markets, kind, selected, onSelect, view = "friction" }) {
  const [lo, hi] = scoreBounds(markets, (m) => viewScore(m, view));
  return (
    <ul className="space-y-1.5" aria-label="Ranked markets">
      {markets.map((m, i) => {
        const blocked = m.status === "blocked";
        const isSel = selected === m.country_code;
        const score = blocked || m.score == null ? null : viewScore(m, view);
        const conf = m.entry.compliance_confidence ?? "verified";
        const tone = score == null ? null : scoreTone(score, lo, hi);
        return (
          <li key={m.country_code} className="rise" style={{ animationDelay: `${180 + i * 70}ms` }}>
            <button
              type="button"
              onClick={() => onSelect(m.country_code)}
              aria-pressed={isSel}
              className={`group relative w-full rounded-xl border px-3.5 py-3 text-left transition-all duration-150 ${
                isSel
                  ? tone
                    ? "ring-1"
                    : "border-neutral-400 bg-white ring-1 ring-neutral-300"
                  : "border-neutral-900/[0.07] bg-white/80 hover:border-neutral-900/20 hover:bg-white hover:shadow-sm"
              } ${blocked ? "bg-neutral-50/60" : ""}`}
              style={
                isSel && tone
                  ? {
                      // Fade from the outline inward: strongest at the edge, clear in the middle.
                      borderColor: tone.edge,
                      background: "rgba(255,255,255,0.92)",
                      "--tw-ring-color": "transparent",
                      boxShadow: `inset 0 0 0 1px ${tone.edge}, inset 0 0 26px -2px ${tone.inner}, 0 4px 16px -10px ${tone.glow}`,
                    }
                  : undefined
              }
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-5 text-center text-xs tabular-nums ${isSel ? "font-semibold text-neutral-900" : "text-neutral-400"}`}
                  style={isSel && tone ? { color: tone.color } : undefined}
                >
                  {blocked ? "–" : m.rank}
                </span>
                <CountryMark code={m.country_code} muted={blocked} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm font-medium ${blocked ? "text-neutral-500" : "text-neutral-900"}`}>{m.country}</span>
                  <span className="mt-0.5 block text-xs text-neutral-500">
                    {blocked ? <Badge tone="danger">Not accessible</Badge> : <TariffLine entry={m.entry} kind={kind} />}
                  </span>
                </span>
                {score == null ? (
                  <span className="shrink-0 text-xl font-semibold leading-none text-neutral-400">—</span>
                ) : (
                  <span className="shrink-0 text-xl font-semibold leading-none tabular-nums tracking-tight" style={{ color: tone.color }}>
                    {score.toFixed(0)}
                  </span>
                )}
              </div>
              {blocked ? (
                <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note}</p>
              ) : m.score == null ? (
                <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note || "Not scored: data unavailable."}</p>
              ) : null}
              {conf !== "verified" && (
                <div className="mt-2 pl-[4.25rem]">
                  <ConfidenceBadge level={conf} />
                </div>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "0% tariff · CPTPP", or in red "50% tariff · CUSMA does not exempt Section 338 tariffs". */
function TariffLine({ entry, kind }) {
  const deal = agreementLine(entry);
  if (kind !== "goods") return deal ? <span>{deal}</span> : null;
  const high = (entry.tariff_rate ?? 0) >= HIGH_TARIFF;
  return (
    <span className={high ? "text-red-800" : ""}>
      <span className={high ? "font-semibold" : ""}>{pct(entry.tariff_rate)} tariff</span>
      {deal && (
        <>
          <span className={high ? "text-red-300" : "text-neutral-300"}> · </span>
          <span>{deal}</span>
        </>
      )}
    </span>
  );
}
