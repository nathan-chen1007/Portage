import { useEffect, useState } from "react";
import { DocumentsPanel } from "./DocumentsPanel.jsx";
import { OutreachPanel } from "./OutreachPanel.jsx";
import { ShipTogether } from "./ShipTogether.jsx";
import { ConfidenceBadge } from "./Confidence.jsx";
import { UNITY_RED, sampleCohort } from "../lib/together.js";
import { Badge, CountryMark, ExternalLink, Icon, Meter, Segmented } from "./ui.jsx";
import {
  COMPONENTS,
  EASE_COLOR,
  PRIZE_COLOR,
  agreementLine,
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
export function MarketPanel({ market, profile, kind, weights, openFactor, onOpenFactor, onExploreFactor, anyProduct = false }) {
  // Paperwork, outreach and Ship together use verified data; for any-product results only the overview applies.
  const tabs = anyProduct ? TABS.filter((t) => t.key === "why") : TABS;
  const [tab, setTab] = useState("why");
  const e = market.entry;
  const blocked = market.status === "blocked";
  const unscored = !blocked && market.score == null; // any-product: a source (e.g. the tariff) didn't answer

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
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {((e.compliance_confidence ?? "verified") !== "verified" || !anyProduct) && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {(e.compliance_confidence ?? "verified") !== "verified" && <ConfidenceBadge level={e.compliance_confidence} />}
                  {!anyProduct && <TogetherChip market={market} kind={kind} category={profile?.category} onOpen={() => setTab("together")} />}
                </div>
              )}
            </>
          )}
        </div>
        {!blocked && !unscored && <HeadlineScore market={market} />}
      </header>

      {!blocked && !unscored && (
        <p className="mt-4 rounded-xl border border-brand/15 bg-brand-50/70 px-4 py-3 text-[15px] leading-relaxed text-neutral-800" data-testid="why-line">
          {whyLine(market, kind).text}
        </p>
      )}

      {unscored ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-800">Not scored: {market.status_note || "a data source didn't answer in time."}</p>
          <Sources entry={e} className="mt-3" />
        </div>
      ) : blocked ? (
        <div className="mt-6 rounded-xl border border-red-100 bg-red-50/50 p-4">
          <p className="text-sm text-neutral-800">{market.status_note || e.status_note}</p>
          <Sources entry={e} className="mt-3" />
        </div>
      ) : (
        <>
          <div className="scroll-thin -mx-1 mt-6 overflow-x-auto px-1 pb-1">
            <Segmented
              options={tabs.map((t) => (t.key === "together" && kind !== "goods" ? { ...t, label: "Team up" } : t))}
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
            {anyProduct && (
              <p className="mt-4 text-xs text-neutral-500">
                Paperwork drafts, partner outreach and Ship together are available for products with verified data (honey, icewine, B2B software).
                For this product, the Trade Commissioner Service can help with the next steps.
              </p>
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
  // The plain answer first; the six-factor breakdown sits behind "See how the score is calculated".
  const [showCalc, setShowCalc] = useState(Boolean(openFactor));
  useEffect(() => {
    if (openFactor) setShowCalc(true);
  }, [openFactor]);
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
    tiles.push({ key: "opportunity", label: "Opportunity", color: PRIZE_COLOR, value: (market.opportunity ?? 0) / 100, points: market.opportunity ?? 0, max: 100 });
  }

  const { usedNote } = whyLine(market, kind);
  const notes = usedNote ? market.entry.notes.slice(1) : market.entry.notes;

  return (
    <div className="space-y-4">
      <PlainRows market={market} kind={kind} />

      {notes.length > 0 && !showCalc && (
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((n) => (
            <p key={n} className="rounded-xl bg-neutral-50 p-3 text-sm text-neutral-600">
              {n}
            </p>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowCalc((o) => !o)}
        aria-expanded={showCalc}
        className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-600"
      >
        {showCalc ? "Hide how the score is calculated" : "See how the score is calculated"}
        <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${showCalc ? "-rotate-90" : "rotate-90"}`} />
      </button>

      {showCalc && (
      <div className="fade-up space-y-4">
      <p className="text-xs text-neutral-500">
        Each factor earns up to its share of the ease score; a full bar means no barrier there. Click one to see what's behind it.
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

      </div>
      )}
      <Sources entry={market.entry} />
    </div>
  );
}

const pctClean = (x) => pct(x, Math.round(x * 1000) % 10 === 0 ? 0 : 1);

/** Tariff, paperwork and shipping in one line each, with the official source. */
function PlainRows({ market, kind }) {
  const e = market.entry;
  const reqs = e.compliance_requirements ?? [];
  const lead = market.lead_time_weeks;
  const goods = kind === "goods";
  const rows = [
    {
      label: "Tariff",
      color: "#2a78d6",
      value: goods
        ? `${pctClean(e.tariff_rate ?? 0)}${e.mfn_rate != null && e.mfn_rate > (e.tariff_rate ?? 0) ? ` (${pctClean(e.mfn_rate)} without the trade deal)` : ""}`
        : "None: software isn't charged duty",
      extra: agreementLine(e),
      source: e.sources?.[0],
    },
    {
      label: "Paperwork",
      color: "#eb6834",
      value:
        reqs.length === 0
          ? "Nothing to file"
          : `${reqs.length} step${reqs.length === 1 ? "" : "s"}${lead == null ? "" : lead === 0 ? ", ready now" : `, about ${weeks(lead)}`}`,
      source: reqs.find((r) => r.source)?.source,
    },
    {
      label: "Shipping",
      color: "#1baf7a",
      value: goods ? e.shipping_route || "–" : "Delivered online",
      source: goods ? e.shipping_source : null,
    },
  ];
  return (
    <dl className="divide-y divide-neutral-900/[0.05] overflow-hidden rounded-xl border border-neutral-900/[0.07] bg-white/70">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
          <dt className="flex w-24 shrink-0 items-center gap-2 text-sm text-neutral-500">
            <span className="h-2 w-2 rounded-full" style={{ background: r.color, boxShadow: `0 0 0 3px ${r.color}22` }} />
            {r.label}
          </dt>
          <dd className="min-w-0 flex-1 text-sm font-medium text-neutral-900">
            {r.value}
            {r.extra && <span className="font-normal text-neutral-500"> · {r.extra}</span>}
          </dd>
          {r.source && (
            <dd className="text-xs">
              <ExternalLink href={r.source} className="text-neutral-400">
                {hostname(r.source)}
              </ExternalLink>
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/** One big number (Overall, or Ease when there's no opportunity data) with the parts in small text. */
function HeadlineScore({ market }) {
  const ez = ease(market);
  const hasOverall = market.overall != null && market.opportunity != null;
  const main = hasOverall ? market.overall : ez;
  return (
    <div className="shrink-0 text-right" title={hasOverall ? "Opportunity and ease combined. Higher is better." : "How clear the path in is. Higher is better."}>
      <div className="bg-gradient-to-br from-brand to-[#8f1a12] bg-clip-text text-4xl font-semibold leading-none tabular-nums tracking-tight text-transparent">
        {Math.round(main)}
      </div>
      <div className="mt-1.5 text-xs font-medium text-neutral-500">{hasOverall ? "Overall score" : "Ease score"}</div>
      {hasOverall && (
        <div className="mt-1 flex items-center justify-end gap-2.5 text-xs tabular-nums text-neutral-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIZE_COLOR }} />
            Opportunity {Math.round(market.opportunity)}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Ease {Math.round(ez)}
          </span>
        </div>
      )}
    </div>
  );
}

/** The first clause of a market note, if it's short enough to sit in the "why" line. */
function noteClause(note) {
  if (!note) return null;
  const clause = note.split(/:|\(| — |\.\s/)[0].trim().replace(/\.$/, "");
  return clause.length <= 70 ? clause : null;
}

/** One "why" sentence from the data: tariff and deal · the market note · time to the first shipment. */
export function whyLine(market, kind) {
  const e = market.entry;
  const parts = [];
  if (kind === "goods") {
    const deal = agreementShort(e.trade_agreement || "");
    if ((e.tariff_rate ?? 0) === 0) parts.push(deal ? `0% tariff under ${deal}` : "No tariff");
    else parts.push(`${pct(e.tariff_rate)} tariff (${agreementLine(e)})`);
  } else if (e.trade_agreement) {
    parts.push(`Covered by ${agreementShort(e.trade_agreement)}`);
  }
  const clause = noteClause(e.notes?.[0]);
  if (clause) parts.push(clause);
  if (market.lead_time_weeks != null) {
    parts.push(
      market.lead_time_weeks === 0
        ? "you could ship once the paperwork is done"
        : `about ${weeks(market.lead_time_weeks)} to your first shipment`,
    );
  }
  return { text: parts.join(" · "), usedNote: Boolean(clause) };
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
          {c?.label ?? "Opportunity"} in {e.country}
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
                      <ConfidenceBadge level={r.confidence ?? "verified"} />
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
  const oc = market.opportunity_components ?? {};
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Imports a year" value={usd(f.import_value_usd)} sub={`${Math.round(f.import_volume_kg / 1000).toLocaleString()} t in ${f.year}`} strong />
        {oc.price === null ? (
          <Stat label="Price after tariff" value="Unavailable" sub="price data unavailable (no import weights reported)" />
        ) : (
          <Stat label="Price after tariff" value={`$${f.net_unit_value_usd_kg.toFixed(2)}/kg`} sub={`Canada sells at $${f.canada_unit_value_usd_kg.toFixed(2)}`} />
        )}
        {oc.growth === null ? (
          <Stat label="Growth" value="Unavailable" sub={`growth data unavailable (${f.growth_years})`} />
        ) : (
          <Stat label="Growth" value={`${f.growth_rate >= 0 ? "+" : ""}${(f.growth_rate * 100).toFixed(1)}%/yr`} sub={f.growth_years} />
        )}
        <Stat label="Canada's share" value={pct(f.canada_share, 1)} sub="of its imports today" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {Object.entries(oc).map(([k, v]) => (
          <div key={k}>
            <div className="flex justify-between text-xs text-neutral-500">
              <span>{OPPORTUNITY_LABELS[k] ?? k}</span>
              <span className="tabular-nums">{v == null ? "n/a" : Math.round(v * 100)}</span>
            </div>
            {v == null ? (
              <p className="mt-1 text-xs text-neutral-400">{k} data unavailable: left out, the rest re-weighted</p>
            ) : (
              <Meter value={v} color={PRIZE_COLOR} className="mt-1" />
            )}
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

/** Header chip: how many Canadian businesses are heading to the same market (preview data). Opens the Ship together tab. */
function TogetherChip({ market, kind, category, onOpen }) {
  const n = sampleCohort(market, kind, category).length;
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
      {n} Canadian {kind === "goods" ? "producers" : "companies"} heading here (sample)
    </button>
  );
}
