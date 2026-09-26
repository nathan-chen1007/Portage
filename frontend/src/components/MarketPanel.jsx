import { useEffect, useState } from "react";
import { DocumentsPanel } from "./DocumentsPanel.jsx";
import { OutreachPanel } from "./OutreachPanel.jsx";
import { ShipTogether } from "./ShipTogether.jsx";
import { UNITY_RED, sampleCohort } from "../lib/together.js";
import { Badge, CountryMark, ExternalLink, Icon, Meter, ScoreRing, Segmented } from "./ui.jsx";
import {
  COMPONENTS,
  EASE_COLOR,
  PRIZE_COLOR,
  agreementShort,
  earned,
  ease,
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
  { key: "together", label: "Ship together" },
];

/** Right-hand panel for one market: scores, clickable factor tiles that expand in place, and the action tabs. */
export function MarketPanel({ market, profile, kind, weights, openFactor, onOpenFactor, onExploreFactor }) {
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
          {blocked ? (
            <div className="mt-2">
              <Badge tone="danger">Not currently accessible</Badge>
            </div>
          ) : (
            <>
              <p className="mt-1.5 text-sm text-neutral-500">
                {[
                  `Rank #${market.rank}`,
                  e.trade_agreement && agreementShort(e.trade_agreement),
                  LANGUAGE_NAMES[e.language] ?? e.language,
                  market.lead_time_weeks != null &&
                    (market.lead_time_weeks === 0
                      ? "Can ship now"
                      : `${weeks(market.lead_time_weeks)} to first shipment${market.lead_time_estimated ? " (est.)" : ""}`),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <ConfidenceBadge level={e.compliance_confidence ?? "verified"} />
                <TogetherChip market={market} kind={kind} onOpen={() => setTab("together")} />
              </div>
            </>
          )}
        </div>
        {!blocked && (
          <div className="flex gap-3">
            {market.overall != null && market.opportunity != null && (
              <ScoreRing value={market.overall} label="Overall" size={56} color="#171717" hint="Prize and ease combined. Higher is better." />
            )}
            {market.opportunity != null && (
              <ScoreRing value={market.opportunity} label="Prize" size={56} color={PRIZE_COLOR} hint="How much the market is worth. Higher is better." />
            )}
            <ScoreRing value={ease(market)} label="Ease" size={56} color={EASE_COLOR} hint="How clear the path in is (100 minus friction). Higher is better." />
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
          <div className="scroll-thin -mx-1 mt-6 overflow-x-auto px-1 pb-1">
            <Segmented
              options={TABS.map((t) => (t.key === "together" && kind !== "goods" ? { ...t, label: "Team up" } : t))}
              value={tab}
              onChange={setTab}
              label="Market sections"
              role="tablist"
              itemRole="tab"
            />
          </div>
          <div className="mt-5">
            {tab === "why" && (
              <Overview market={market} kind={kind} weights={weights} openFactor={openFactor} onOpenFactor={onOpenFactor} onExploreFactor={onExploreFactor} />
            )}
            {tab === "docs" && <DocumentsPanel profile={profile} countryCode={e.country_code} />}
            {tab === "partners" && <OutreachPanel profile={profile} market={market} />}
            {tab === "together" && <ShipTogether market={market} kind={kind} profile={profile} />}
          </div>
        </>
      )}
    </section>
  );
}

function Overview({ market, kind, weights, openFactor, onOpenFactor, onExploreFactor }) {
  // Each factor shows the ease points it earns out of its weight: a full bar means no barrier there.
  const tiles = [
    ...COMPONENTS.map((c) => {
      const { points, max } = earned(market, c.key, weights);
      return {
        key: c.key,
        label: c.label,
        color: c.color,
        value: 1 - (market.components?.[c.key] ?? 0),
        points,
        max,
        blocker: market.top_blocker === c.key,
      };
    }),
  ];
  if (market.opportunity_facts) {
    tiles.push({ key: "opportunity", label: "Prize", color: PRIZE_COLOR, value: (market.opportunity ?? 0) / 100, points: market.opportunity ?? 0, max: 100 });
  }

  return (
    <div className="space-y-4">
      <p
        className="text-[11px] font-medium uppercase tracking-wide text-neutral-400"
        title="Each factor earns up to its share of the ease score. A full bar means no barrier. Click a factor for details."
      >
        Score breakdown · click a factor for details
      </p>
      <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 ${tiles.length > 5 ? "xl:grid-cols-6" : "xl:grid-cols-5"}`}>
        {tiles.map((t) => {
          const open = openFactor === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-expanded={open}
              onClick={() => onOpenFactor(open ? null : t.key)}
              className={`relative rounded-xl border p-3 text-left transition-all duration-150 ${
                open ? "bg-white shadow-[0_2px_10px_rgba(0,0,0,0.07)]" : "border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm"
              }`}
              style={open ? { borderColor: t.color } : undefined}
            >
              <span className="flex items-center gap-1.5 text-xs text-neutral-500">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: t.color }} />
                <span className="truncate">{t.label}</span>
              </span>
              <span className="mt-1.5 block text-xl font-semibold tabular-nums">
                {Math.round(t.points)}
                <span className="ml-1 text-[11px] font-normal text-neutral-400">/ {Math.round(t.max)}</span>
              </span>
              {t.blocker && (
                <span
                  className="absolute -top-2 right-2 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold uppercase leading-none tracking-wide text-white shadow-sm"
                  title="Costs this market the most points"
                >
                  Worst
                </span>
              )}
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
  const color = c?.color ?? PRIZE_COLOR;

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
                <span className="tabular-nums" title="0–100, higher is better">{Math.round((1 - (market.factors?.[f] ?? 0)) * 100)}</span>
              </div>
              <Meter value={1 - (market.factors?.[f] ?? 0)} color={color} className="mt-1" />
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
            <Meter value={v} color={PRIZE_COLOR} className="mt-1" />
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

/** Header chip: how many Canadian businesses are heading to the same market (preview data). Opens the Ship together tab. */
function TogetherChip({ market, kind, onOpen }) {
  const n = sampleCohort(market, kind).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Preview: sample producers"
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors hover:bg-red-50"
      style={{ borderColor: `${UNITY_RED}55`, color: UNITY_RED }}
    >
      <span className="flex -space-x-1" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full border border-white" style={{ background: UNITY_RED, opacity: 1 - i * 0.25 }} />
        ))}
      </span>
      {n} Canadian {kind === "goods" ? "producers" : "companies"} heading here
    </button>
  );
}
