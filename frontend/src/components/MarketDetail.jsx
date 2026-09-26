import { useState } from "react";
import { DocumentsPanel } from "./DocumentsPanel.jsx";
import { OutreachPanel } from "./OutreachPanel.jsx";
import { Badge, ExternalLink } from "./ui.jsx";
import { COMPONENTS, TIER_LABEL, flag, hostname, pct, usd } from "../lib/format.js";

const TABS = [
  { id: "why", label: "Why this score" },
  { id: "docs", label: "Paperwork" },
  { id: "partners", label: "Partners & outreach" },
];

export function MarketDetail({ market, profile, kind }) {
  const [tab, setTab] = useState("why");
  const e = market.entry;
  const blocked = market.status === "blocked";

  return (
    <section className="fade-up rounded-xl border border-neutral-200 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-semibold tracking-tight">
          <span aria-hidden className="mr-2">{flag(e.country_code)}</span>
          {e.country}
        </h2>
        {blocked ? (
          <Badge tone="danger">Not currently accessible</Badge>
        ) : (
          <span className="text-sm text-neutral-500">
            {market.overall != null && market.opportunity != null && (
              <>
                Overall <span className="font-semibold tabular-nums text-neutral-900">{market.overall.toFixed(1)}</span> ·
                Opportunity <span className="font-semibold tabular-nums text-neutral-900">{market.opportunity.toFixed(1)}</span> ·{" "}
              </>
            )}
            Friction <span className="font-semibold tabular-nums text-neutral-900">{market.score.toFixed(1)}</span> / 100 · rank #{market.rank}
          </span>
        )}
      </div>

      {blocked ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-neutral-700">{market.status_note || e.status_note}</p>
          <Sources entry={e} />
        </div>
      ) : (
        <>
          <div role="tablist" className="mt-5 inline-flex rounded-lg bg-neutral-100 p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                type="button"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  tab === t.id ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-5">
            {tab === "why" && <WhyTab market={market} kind={kind} />}
            {tab === "docs" && <DocumentsPanel profile={profile} countryCode={e.country_code} />}
            {tab === "partners" && <OutreachPanel profile={profile} market={market} />}
          </div>
        </>
      )}
    </section>
  );
}

function WhyTab({ market, kind }) {
  const e = market.entry;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {COMPONENTS.map((c) => (
          <div key={c.key} className="rounded-lg border border-neutral-200 px-3 py-2.5" title={c.help}>
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.label}
            </div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{(market.breakdown?.[c.key] ?? 0).toFixed(1)}</div>
          </div>
        ))}
      </div>

      {market.opportunity_facts && <OpportunityFacts facts={market.opportunity_facts} />}

      {kind === "goods" && (
        <div>
          <h3 className="text-sm font-medium">Tariff</h3>
          <p className="mt-1 text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{pct(e.tariff_rate)}</span> for a Canadian exporter
            {e.mfn_rate > e.tariff_rate && <> (vs {pct(e.mfn_rate, 1)} without a trade agreement)</>}. {e.tariff_note}
          </p>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium">What you need to clear</h3>
        {e.compliance_requirements.length === 0 ? (
          <p className="mt-1 text-sm text-neutral-600">No specific requirements.</p>
        ) : (
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {e.compliance_requirements.map((r) => (
              <li key={r.name} className="px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{r.name}</span>
                  <span className="shrink-0 text-xs text-neutral-500">{TIER_LABEL[r.tier]}</span>
                </div>
                <p className="mt-0.5 text-sm text-neutral-600">{r.detail}</p>
                <ExternalLink href={r.source} className="mt-0.5 inline-block text-xs text-neutral-400">
                  {hostname(r.source)}
                </ExternalLink>
              </li>
            ))}
          </ul>
        )}
      </div>

      {(e.tax_note || e.notes.length > 0) && (
        <div className="space-y-1 text-sm text-neutral-600">
          {e.tax_note && (
            <p>
              <span className="font-medium text-neutral-900">Tax:</span> {e.tax_note}
            </p>
          )}
          {e.notes.map((n) => (
            <p key={n}>{n}</p>
          ))}
        </div>
      )}

      <Sources entry={e} />
    </div>
  );
}

function Sources({ entry }) {
  return (
    <p className="text-xs text-neutral-400">
      Data as of {entry.as_of}. Sources:{" "}
      {entry.sources.map((s, i) => (
        <span key={s}>
          {i > 0 && ", "}
          <ExternalLink href={s}>{hostname(s)}</ExternalLink>
        </span>
      ))}
    </p>
  );
}

function OpportunityFacts({ facts: f }) {
  const tiles = [
    ["Imports a year", usd(f.import_value_usd), `${Math.round(f.import_volume_kg / 1000).toLocaleString()} t in ${f.year}`],
    ["Price after tariff", `$${f.net_unit_value_usd_kg.toFixed(2)}/kg`, `pays $${f.unit_value_usd_kg.toFixed(2)}; Canada sells at $${f.canada_unit_value_usd_kg.toFixed(2)}`],
    ["Growth", `${f.growth_rate >= 0 ? "+" : ""}${(f.growth_rate * 100).toFixed(1)}%/yr`, f.growth_years],
    ["Canada's share", pct(f.canada_share, 1), "of its imports today"],
  ];
  return (
    <div>
      <h3 className="text-sm font-medium">Why it's worth it</h3>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-neutral-200 px-3 py-2.5">
            <div className="text-xs text-neutral-500">{label}</div>
            <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
            <div className="text-xs text-neutral-400">{sub}</div>
          </div>
        ))}
      </div>
      {f.note && <p className="mt-2 text-xs text-neutral-500">{f.note}</p>}
      <p className="mt-1 text-xs text-neutral-400">
        UN Comtrade:{" "}
        <ExternalLink href={f.sources[0]}>{hostname(f.sources[0])}</ExternalLink>
      </p>
    </div>
  );
}
