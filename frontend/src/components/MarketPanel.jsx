import { useEffect, useState } from "react";
import { DocumentsPanel } from "./DocumentsPanel.jsx";
import { OutreachPanel } from "./OutreachPanel.jsx";
import { Badge, CountryMark, ExternalLink, Icon, Meter, ScoreRing, Segmented } from "./ui.jsx";
import {
  COMPONENTS,
  agreementShort,
  FACTOR_LABELS,
  LANGUAGE_NAMES,
  OPPORTUNITY_LABELS,
  TIER_LABEL,
  component,
  hostname,
  nm,
  pct,
  usd,
  weeks,
} from "../lib/format.js";

const TABS = [
  { key: "why", label: "Overview" },
  { key: "docs", label: "Paperwork" },
  { key: "partners", label: "Partners & outreach" },
];

/** Right-hand panel for one market: scores, clickable factor tiles that expand in place, and the action tabs. */
export function MarketPanel({ market, profile, kind, openFactor, onOpenFactor, onExploreFactor }) {
  const [tab, setTab] = useState("why");
  const e = market.entry;
  const blocked = market.status === "blocked";

  useEffect(() => setTab("why"), [market.country_code]);

  return (
    <section className="slide-in" aria-labelledby="market-title">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="market-title" className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <CountryMark code={e.country_code} size="lg" />
            {e.country}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {blocked ? (
              <Badge tone="danger">Not currently accessible</Badge>
            ) : (
              <>
                <Badge>Rank #{market.rank}</Badge>
                {e.trade_agreement && <Badge tone="outline">{agreementShort(e.trade_agreement)}</Badge>}
                <Badge tone="outline">{LANGUAGE_NAMES[e.language] ?? e.language}</Badge>
                <ConfidenceBadge level={e.compliance_confidence ?? "verified"} />
                {market.lead_time_weeks != null && (
                  <Badge tone="outline">
                    <Icon name="clock" className="h-3 w-3" />
                    {market.lead_time_weeks === 0 ? "Can ship now" : `${weeks(market.lead_time_weeks)} to first shipment`}
                    {market.lead_time_estimated && market.lead_time_weeks > 0 && " (est.)"}
                  </Badge>
                )}
              </>
            )}
          </div>
        </div>
        {!blocked && (
          <div className="flex gap-4">
            {market.overall != null && market.opportunity != null && (
              <ScoreRing value={market.overall} label="Overall" color="#171717" hint="Opportunity and ease combined. Higher is better." />
            )}
            {market.opportunity != null && (
              <ScoreRing value={market.opportunity} label="Prize" color="#0f766e" hint="How much the market is worth. Higher is better." />
            )}
            <ScoreRing value={market.score} label="Friction" color="#eb6834" hint="Barriers to entry. Lower is easier." />
          </div>
        )}
      </header>

      {blocked ? (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p className="text-sm text-neutral-800">{market.status_note || e.status_note}</p>
          <Sources entry={e} className="mt-3" />
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Segmented options={TABS} value={tab} onChange={setTab} label="Market sections" role="tablist" itemRole="tab" />
          </div>
          <div className="mt-5">
            {tab === "why" && (
              <Overview market={market} kind={kind} openFactor={openFactor} onOpenFactor={onOpenFactor} onExploreFactor={onExploreFactor} />
            )}
            {tab === "docs" && <DocumentsPanel profile={profile} countryCode={e.country_code} />}
            {tab === "partners" && <OutreachPanel profile={profile} market={market} />}
          </div>
        </>
      )}
    </section>
  );
}

function Overview({ market, kind, openFactor, onOpenFactor, onExploreFactor }) {
  const tiles = [
    ...COMPONENTS.map((c) => ({
      key: c.key,
      label: c.label,
      color: c.color,
      value: market.components?.[c.key] ?? 0,
      points: market.breakdown?.[c.key] ?? 0,
      blocker: market.top_blocker === c.key,
    })),
  ];
  if (market.opportunity_facts) {
    tiles.push({ key: "opportunity", label: "Prize", color: "#0f766e", value: (market.opportunity ?? 0) / 100, points: null });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-neutral-500">Click a factor to see what's behind it.</p>
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${tiles.length > 5 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        {tiles.map((t) => {
          const open = openFactor === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-expanded={open}
              onClick={() => onOpenFactor(open ? null : t.key)}
              className={`rounded-xl border p-3 text-left transition-all duration-150 ${
                open ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)]" : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
              }`}
              style={open ? { borderColor: t.color } : undefined}
            >
              <span className="flex items-center justify-between gap-1 text-xs text-neutral-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: t.color }} />
                  {t.label}
                </span>
                {t.blocker && <span className="rounded bg-neutral-900 px-1 text-[9px] font-semibold uppercase text-white">Top</span>}
              </span>
              <span className="mt-1.5 block text-xl font-semibold tabular-nums">
                {t.points == null ? Math.round(t.value * 100) : t.points.toFixed(1)}
                <span className="ml-1 text-[11px] font-normal text-neutral-400">{t.points == null ? "/100" : "pts"}</span>
              </span>
              <Meter value={t.value} color={t.color} className="mt-2" />
            </button>
          );
        })}
      </div>

      <div className="expand" data-open={Boolean(openFactor)}>
        <div>
          {openFactor && tiles.some((t) => t.key === openFactor) && (
            <FactorDetail key={openFactor} market={market} kind={kind} factorKey={openFactor} onExplore={() => onExploreFactor(openFactor)} />
          )}
        </div>
      </div>

      {!openFactor && (
        <div className="grid gap-3 sm:grid-cols-2">
          {market.entry.notes.map((n) => (
            <p key={n} className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
              {n}
            </p>
          ))}
        </div>
      )}
      <Sources entry={market.entry} />
    </div>
  );
}

/** Market-specific detail for one factor. */
function FactorDetail({ market, kind, factorKey, onExplore }) {
  const e = market.entry;
  const c = component(factorKey);
  const color = c?.color ?? "#0f766e";

  return (
    <div className="fade-up rounded-xl border bg-white p-4" style={{ borderColor: `${color}55` }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          {c?.label ?? "Prize"} in {e.country}
        </h3>
        {c && (
          <button type="button" onClick={onExplore} className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
            Compare all markets <Icon name="chevron" className="h-3 w-3" />
          </button>
        )}
      </div>

      {c?.factors?.length > 0 && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {c.factors.map((f) => (
            <div key={f}>
              <div className="flex justify-between text-xs text-neutral-500">
                <span>{FACTOR_LABELS[f]}</span>
                <span className="tabular-nums">{Math.round((market.factors?.[f] ?? 0) * 100)}</span>
              </div>
              <Meter value={market.factors?.[f]} color={color} className="mt-1" />
            </div>
          ))}
        </div>
      )}

      {factorKey === "tariff" && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="You pay" value={kind === "goods" ? pct(e.tariff_rate) : "None"} strong />
          <Stat label="Without an agreement" value={kind === "goods" ? pct(e.mfn_rate, 1) : "None"} />
          <Stat label="Agreement" value={e.trade_agreement ? agreementShort(e.trade_agreement) : "None"} />
          <p className="text-sm text-neutral-600 sm:col-span-3">{e.tariff_note}</p>
        </div>
      )}

      {factorKey === "compliance" && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            {market.lead_time_weeks === 0 ? "No waiting period: you could ship once the paperwork is done." : (
              <>
                <span className="font-semibold text-neutral-900">{weeks(market.lead_time_weeks)}</span> before the first legal shipment
                {market.lead_time_estimated ? " (our estimate; the longest step sets the pace)." : " (official figure)."}
              </>
            )}
          </p>
          {e.compliance_requirements.length === 0 ? (
            <p className="text-sm text-neutral-500">No specific requirements.</p>
          ) : (
            <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
              {e.compliance_requirements.map((r) => (
                <li key={r.name} className="px-3 py-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{r.name}</span>
                    <span className="flex items-center gap-1.5">
                      <Badge>{TIER_LABEL[r.tier]}</Badge>
                      {r.confidence && r.confidence !== "verified" && <ConfidenceBadge level={r.confidence} />}
                      {r.lead_time_weeks > 0 && (
                        <Badge tone="outline">
                          {weeks(r.lead_time_weeks)}
                          {r.lead_time_basis === "estimate" && " est."}
                        </Badge>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-neutral-600">{r.detail}</p>
                  <ExternalLink href={r.source} className="mt-0.5 inline-block text-xs text-neutral-400">
                    {hostname(r.source)}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {factorKey === "logistics" &&
        (kind !== "goods" ? (
          <p className="text-sm text-neutral-600">Software is delivered online, so shipping doesn't apply.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Sea distance" value={nm(e.sea_distance_nm)} />
              <Stat label="Sailings a week" value={e.weekly_sailings == null ? "–" : e.weekly_sailings} />
              <Stat label="Customs (LPI, of 5)" value={e.lpi_customs_score ?? "–"} />
            </div>
            {e.shipping_route && (
              <p className="flex items-start gap-2 text-sm text-neutral-600">
                <Icon name="ship" className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <span>
                  {e.shipping_route}
                  {e.shipping_source && (
                    <ExternalLink href={e.shipping_source} className="ml-1.5 text-xs text-neutral-400">
                      {hostname(e.shipping_source)}
                    </ExternalLink>
                  )}
                </span>
              </p>
            )}
          </div>
        ))}

      {factorKey === "risk" &&
        (market.country_facts ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Currency" value={market.country_facts.currency} />
            <Stat label="Swings vs CAD / year" value={pct(market.country_facts.fx_volatility, 1)} />
            <Stat label="OECD country risk (0–7)" value={market.country_facts.country_risk} />
            <p className="text-xs text-neutral-500 sm:col-span-3">
              {market.country_facts.fx_note}{" "}
              <ExternalLink href={market.country_facts.fx_source} className="text-neutral-400">
                {hostname(market.country_facts.fx_source)}
              </ExternalLink>{" "}
              ·{" "}
              <ExternalLink href={market.country_facts.country_risk_source} className="text-neutral-400">
                {hostname(market.country_facts.country_risk_source)}
              </ExternalLink>
            </p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">No currency or country-risk data for this market.</p>
        ))}

      {factorKey === "tax" && <p className="text-sm text-neutral-600">{e.tax_note || "No tax obligations for you in this market."}</p>}

      {factorKey === "opportunity" && market.opportunity_facts && <Opportunity market={market} />}
    </div>
  );
}

function Opportunity({ market }) {
  const f = market.opportunity_facts;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Imports a year" value={usd(f.import_value_usd)} sub={`${Math.round(f.import_volume_kg / 1000).toLocaleString()} t in ${f.year}`} strong />
        <Stat label="Price after tariff" value={`$${f.net_unit_value_usd_kg.toFixed(2)}/kg`} sub={`Canada sells at $${f.canada_unit_value_usd_kg.toFixed(2)}`} />
        <Stat label="Growth" value={`${f.growth_rate >= 0 ? "+" : ""}${(f.growth_rate * 100).toFixed(1)}%/yr`} sub={f.growth_years} />
        <Stat label="Canada's share" value={pct(f.canada_share, 1)} sub="of its imports today" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(market.opportunity_components ?? {}).map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{OPPORTUNITY_LABELS[k] ?? k}</span>
              <span className="tabular-nums">{Math.round(v * 100)}</span>
            </div>
            <Meter value={v} color="#0f766e" className="mt-1" />
          </div>
        ))}
      </div>
      {f.note && <p className="text-sm text-neutral-600">{f.note}</p>}
      <p className="text-xs text-neutral-400">
        Trade data: <ExternalLink href={f.sources[0]}>{hostname(f.sources[0])}</ExternalLink>
      </p>
    </div>
  );
}

function Stat({ label, value, sub, strong }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2.5">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className={`mt-0.5 tabular-nums ${strong ? "text-lg font-semibold" : "text-base font-medium"}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-400">{sub}</div>}
    </div>
  );
}

function Sources({ entry, className = "" }) {
  return (
    <p className={`text-xs text-neutral-400 ${className}`}>
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

// How much to trust the compliance data: verified (a person read the official source), auto-sourced
// (official structured data, not yet checked by a person), unknown (no data: ask the Trade Commissioner Service).
const CONFIDENCE = {
  verified: { tone: "success", label: "Compliance verified", title: "A person checked every requirement against the official source." },
  auto_sourced: { tone: "accent", label: "Auto-sourced", title: "From official structured data, not yet checked by a person. Confirm with CFIA or the Trade Commissioner Service." },
  unknown: { tone: "danger", label: "Compliance not verified", title: "No compliance data yet. Confirm with the Trade Commissioner Service before shipping." },
};

function ConfidenceBadge({ level }) {
  const c = CONFIDENCE[level] ?? CONFIDENCE.unknown;
  return (
    <Badge tone={c.tone}>
      <span title={c.title}>{c.label}</span>
    </Badge>
  );
}
