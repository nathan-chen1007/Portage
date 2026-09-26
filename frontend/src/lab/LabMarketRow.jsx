import { useState } from "react";
import { Badge, CountryMark, ExternalLink } from "../components/ui.jsx";
import { agreementShort, hostname, pct, usd, viewScore, weeks } from "../lib/format.js";
import { ConfidenceBadge } from "./ConfidenceBadge.jsx";

const SCORE_LABEL = { overall: "score", friction: "ease", opportunity: "prize" };
const TCS = "https://www.tradecommissioner.gc.ca/";
const rate = (x) => pct(x, 1).replace(".0%", "%");

/** One ranked market with its data-quality flags. Click to expand the sourced details. */
export function LabMarketRow({ market: m, status: s, view }) {
  const [open, setOpen] = useState(false);
  const scored = m.score != null;
  const score = scored ? viewScore(m, view) : null;
  const conf = s?.compliance_confidence ?? m.entry.compliance_confidence;
  const e = m.entry;
  const f = m.opportunity_facts;
  return (
    <li className={`rounded-xl border bg-white ${conf === "unknown" ? "border-amber-200" : "border-neutral-200"}`}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full px-3.5 py-3 text-left">
        <div className="flex items-center gap-3">
          <span className="w-5 text-center text-xs tabular-nums text-neutral-400">{scored ? m.rank : "–"}</span>
          <CountryMark code={m.country_code} muted={!scored} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-neutral-900">{m.country}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-neutral-500">
              {m.status === "blocked" ? (
                <Badge tone="danger">Not accessible</Badge>
              ) : s?.tariff === "pending" ? (
                <Badge tone="outline">Tariff loading…</Badge>
              ) : !scored ? (
                <Badge tone="danger">Tariff unavailable</Badge>
              ) : (
                <>
                  <span className={e.tariff_rate > 0 ? "font-semibold text-neutral-900" : ""}>{rate(e.tariff_rate)} tariff</span>
                  {s?.tariff_year && <span className="text-neutral-400">({s.tariff_year})</span>}
                  {s?.tariff === "mfn_only" && <Badge tone="outline">MFN, no FTA rate on record</Badge>}
                  {s?.section338 === "listed" && <Badge tone="danger">US Section 338 +50%</Badge>}
                  {s?.section338 === "unknown" && <Badge tone="outline">Section 338 unchecked</Badge>}
                  {e.trade_agreement && <span>· {agreementShort(e.trade_agreement)}</span>}
                </>
              )}
            </span>
          </span>
          <span className="flex flex-col items-end gap-1">
            <span className="flex items-center gap-2">
              {m.status !== "blocked" && <ConfidenceBadge value={conf} />}
              <span className="text-xl font-semibold leading-none tabular-nums tracking-tight">{score == null ? "—" : score.toFixed(0)}</span>
            </span>
            {scored && <span className="text-[10px] uppercase tracking-wide text-neutral-400">{SCORE_LABEL[view] ?? "score"}</span>}
          </span>
        </div>
        {m.status === "blocked" && <p className="mt-2 line-clamp-2 pl-[4.25rem] text-xs text-neutral-500">{m.status_note}</p>}
        {conf === "unknown" && m.status !== "blocked" && (
          <p className="mt-2 pl-[4.25rem] text-xs font-medium text-amber-800">
            Compliance not verified — confirm with the Trade Commissioner Service. Scored with an assumed typical burden.
          </p>
        )}
      </button>
      {open && (
        <div className="space-y-3 border-t border-neutral-100 px-3.5 py-3 pl-[4.25rem] text-xs text-neutral-600">
          <p><span className="font-medium text-neutral-900">Tariff.</span> {e.tariff_note || m.status_note}</p>
          {f ? (
            <p>
              <span className="font-medium text-neutral-900">Opportunity.</span> Imports {usd(f.import_value_usd)} in {f.year} at ${f.unit_value_usd_kg}/kg
              (${f.net_unit_value_usd_kg}/kg after tariff vs Canada's ${f.canada_unit_value_usd_kg}/kg); growth {pct(f.growth_rate, 1)}/yr {f.growth_years};
              Canada's share {pct(f.canada_share, 1)}.
            </p>
          ) : (
            <p><span className="font-medium text-neutral-900">Opportunity.</span> No trade data: ranked on ease only.</p>
          )}
          <div>
            <p className="font-medium text-neutral-900">Compliance</p>
            <ul className="mt-1 space-y-1">
              {e.compliance_requirements.map((r) => (
                <li key={r.name} className="flex items-start gap-2">
                  <ConfidenceBadge value={r.confidence} />
                  <span>
                    {r.name} <span className="text-neutral-400">(tier {r.tier}{r.lead_time_weeks ? `, ~${weeks(r.lead_time_weeks)}` : ""})</span>
                  </span>
                </li>
              ))}
            </ul>
            {conf === "unknown" && (
              <p className="mt-1">
                <ExternalLink href={TCS} className="font-medium text-amber-800">Ask the Trade Commissioner Service →</ExternalLink>
              </p>
            )}
          </div>
          <p><span className="font-medium text-neutral-900">Shipping.</span> {e.shipping_route || "–"}</p>
          <p className="flex flex-wrap gap-x-2 gap-y-1">
            <span className="font-medium text-neutral-900">Sources.</span>
            {[...new Set([...e.sources, ...(f?.sources ?? [])])].map((u) => (
              <ExternalLink key={u} href={u} className="text-neutral-500">{hostname(u)}</ExternalLink>
            ))}
          </p>
        </div>
      )}
    </li>
  );
}
