import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api.js";
import { Badge, Button, Slider, useReveal } from "./ui.jsx";
import { CONTAINER_KG, UNITY_RED, cad, freightEstimate, ownLabel, sampleCohort, sharedCosts } from "../lib/together.js";

// Inside a market panel the theme is that market's score colour (set as --color-brand by MarketPanel).
// Only the word "Canada" in the headline stays Canada red.
const THEME = "var(--color-brand)";

/**
 * "Ship together" (PREVIEW, sample data): small Canadian exporters heading to the same market pool one
 * shipment and split the fixed costs. Theme: strength through unity.
 */
export function ShipTogether({ market, kind, profile }) {
  const goods = kind === "goods";
  const category = profile?.category;
  const cohort = useMemo(() => sampleCohort(market, kind, category), [market, kind, category]);
  const [joined, setJoined] = useState(false);
  const [myKg, setMyKg] = useState(2000);
  const [copied, setCopied] = useState(false);

  const country = market.entry.country;
  const provinces = [...new Set(cohort.map((m) => m.prov))];
  const others = cohort.length;
  const size = others + (joined ? 1 : 0);
  const withMe = others + 1;

  // Goods: container fill and freight per kg.
  const othersKg = cohort.reduce((a, m) => a + (m.kg ?? 0), 0);
  const totalKg = othersKg + (joined ? myKg : 0);
  const f = freightEstimate(market);
  const containerCost = f.pooled * CONTAINER_KG;
  const pooledKg = othersKg + myKg;
  const pooledPerKg = (containerCost * Math.ceil(pooledKg / CONTAINER_KG)) / pooledKg;
  const saving = 1 - pooledPerKg / f.solo;

  // Fixed costs split across the group.
  const costs = sharedCosts(market, kind);
  const soloFixed = costs.reduce((a, c) => a + c.solo, 0);
  const myShare = soloFixed / withMe;

  const me = profile?.company_name || ownLabel(kind, category);

  async function invite() {
    try {
      await navigator.clipboard.writeText(`Join me on Portage: we're pooling a shipment to ${country}.`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-5">
      {/* ---------- headline ---------- */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-gradient-to-br from-white to-neutral-50 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">Preview: sample group</Badge>
          <span className="text-xs text-neutral-500">
            {provinces.length} provinces · {others} {goods ? "producers" : "companies"} heading to {country}
          </span>
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          Growing <span style={{ color: UNITY_RED }}>Canada</span>, together.
        </h3>
        <p className="mt-1 max-w-xl text-sm text-neutral-600">
          {goods
            ? `One small producer can't fill a container. ${withMe} Canadian producers heading to ${country} can, and they split the broker and the freight.`
            : `One startup can't justify a local office in ${country}. ${withMe} Canadian software companies selling there can share one, and split the legal and compliance costs.`}
        </p>

        <UnityMap cohort={cohort} joined={joined} me={me} country={market.entry.country_code} goods={goods} fill={goods ? totalKg / CONTAINER_KG : size / withMe} />
      </div>

      {/* ---------- the numbers ---------- */}
      <div className="grid gap-3 sm:grid-cols-3">
        {goods ? (
          <>
            <StatCard
              label="Container filled"
              value={`${(Math.min(totalKg, CONTAINER_KG) / 1000).toFixed(1)} of ${CONTAINER_KG / 1000} t`}
              sub={joined ? `with your ${(myKg / 1000).toFixed(1)} t` : `${((CONTAINER_KG - othersKg) / 1000).toFixed(1)} t of space left`}
              meter={Math.min(1, totalKg / CONTAINER_KG)}
            />
            <StatCard
              label="Freight per kg"
              value={`$${pooledPerKg.toFixed(2)}`}
              sub={
                saving > 0 ? (
                  <>
                    <span className="line-through">${f.solo.toFixed(2)} alone</span> ·{" "}
                    <span className="font-semibold" style={{ color: THEME }}>
                      −{Math.round(saving * 100)}%
                    </span>
                  </>
                ) : (
                  <>${f.solo.toFixed(2)} alone · no saving until the container fills up</>
                )
              }
            />
          </>
        ) : (
          <StatCard label="Companies sharing" value={`${withMe}`} sub={`from ${provinces.length} provinces`} meter={size / withMe} />
        )}
        <StatCard
          label="Your share of fixed costs"
          value={cad(myShare)}
          sub={
            <>
              <span className="line-through">{cad(soloFixed)} alone</span> · split {withMe} ways
            </>
          }
        />
        {!goods && <StatCard label="You save" value={cad(soloFixed - myShare)} sub="in the first year" />}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_16rem]">
        {/* ---------- who's in ---------- */}
        <div>
          <h4 className="mb-2 text-sm font-semibold">Who's heading to {country}</h4>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {joined && (
              <li className="pop flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: THEME }}>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{me}</span>
                  <span className="text-xs text-neutral-500">{[profile?.city, profile?.province].filter(Boolean).join(", ") || "You"}</span>
                </span>
                {goods && <span className="shrink-0 text-xs font-medium tabular-nums">{(myKg / 1000).toFixed(1)} t</span>}
              </li>
            )}
            {cohort.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{m.name}</span>
                  <span className="text-xs text-neutral-500">
                    {m.town}, {m.prov} · joined {m.joinedDaysAgo}d ago
                  </span>
                </span>
                {goods && <span className="shrink-0 text-xs tabular-nums text-neutral-500">{(m.kg / 1000).toFixed(1)} t</span>}
              </li>
            ))}
          </ul>
          <h4 className="mb-1.5 mt-4 text-sm font-semibold">What the group shares</h4>
          <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200 text-sm">
            {costs.map((c) => (
              <li key={c.label} className="flex items-center justify-between px-3 py-2">
                <span className="text-neutral-700">{c.label}</span>
                <span className="tabular-nums text-neutral-500">
                  <span className="mr-2 text-xs line-through">{cad(c.solo)}</span>
                  <span className="font-medium text-neutral-900">{cad(c.solo / withMe)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- join ---------- */}
        <div className="rounded-2xl border border-neutral-200 p-4">
          {goods && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-neutral-500">
                <span>Your shipment</span>
                <span className="font-medium tabular-nums text-neutral-900">{(myKg / 1000).toFixed(1)} t</span>
              </div>
              <Slider value={myKg} min={500} max={5000} step={100} onChange={setMyKg} color={THEME} label="Your shipment in kilograms" className="mt-1" />
            </div>
          )}
          {joined ? (
            <div className="pop text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: THEME }}>
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
                  <path d="M5 10.5l3 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-semibold">You're in the group.</p>
              <p className="text-xs font-medium" style={{ color: THEME }}>
                Growing Canada, together.
              </p>
              <p className="text-xs text-neutral-500">
                {goods
                  ? "When there's enough volume, we'll introduce you to a freight partner who ships for the whole group."
                  : "When there are enough companies, we'll introduce you to a partner who serves the whole group."}
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={invite}>
                {copied ? "Invite copied" : "Invite a producer you know"}
              </Button>
              <button type="button" onClick={() => setJoined(false)} className="mt-2 text-xs text-neutral-400 hover:text-neutral-700">
                Leave
              </button>
            </div>
          ) : (
            <>
              <Button size="lg" className="w-full" onClick={() => setJoined(true)}>
                Join the group
              </Button>
              <p className="mt-2 text-center text-xs text-neutral-500">Free to join. Portage matches exporters; it never books or ships.</p>
            </>
          )}
        </div>
      </div>

      {goods && joined && <FreightQuote market={market} cohort={cohort} myKg={myKg} myProvince={profile?.province} category={category} />}

      <p className="text-[11px] leading-relaxed text-neutral-400">
        Preview: the {goods ? "producers" : "companies"} shown are sample data. In the full product, Portage matches exporters heading to the same
        market and a freight forwarder confirms real quotes. Costs are illustrative estimates.
      </p>
    </div>
  );
}

function StatCard({ label, value, sub, meter }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3">
      <div className="text-[11px] text-neutral-500">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
      {meter != null && (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${meter * 100}%`, background: THEME }} />
        </div>
      )}
    </div>
  );
}

/** Producers from across Canada converge into one shared container (or shared desk), which travels to the market. */
function UnityMap({ cohort, joined, me, country, goods, fill }) {
  const W = 620;
  const H = 230;
  const nodes = [...cohort.map((m) => ({ key: m.id, label: m.prov, you: false })), { key: "you", label: "You", you: true }];
  const step = (H - 40) / Math.max(1, nodes.length - 1);
  const cx = 370;
  const cy = H / 2;
  const f = Math.max(0, Math.min(1, fill));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 h-auto w-full" role="img" aria-label={`${nodes.length - 1} Canadian businesses${joined ? " and you" : ""} joining one ${goods ? "shipment" : "group"} to ${country}`}>
      {/* converging lanes */}
      {nodes.map((n, i) => {
        const y = 20 + i * step;
        const active = !n.you || joined;
        const d = `M 112 ${y} C 240 ${y}, 250 ${cy}, ${cx - 52} ${cy}`;
        return (
          <g key={n.key}>
            <path d={d} fill="none" stroke={n.you ? (joined ? THEME : "#d4d4d4") : "#e5e5e5"} strokeWidth={n.you && joined ? 2 : 1.5} strokeDasharray={n.you && !joined ? "4 4" : undefined} />
            {active && <path d={d} fill="none" stroke={n.you ? THEME : "#404040"} strokeWidth="1.5" className="flow" style={{ animationDelay: `${i * 0.15}s` }} />}
            <circle cx="100" cy={y} r={n.you ? 13 : 11.5} fill={n.you ? (joined ? THEME : "#fff") : "#171717"} stroke={n.you ? (joined ? THEME : "#a3a3a3") : "#171717"} strokeWidth="1.5" strokeDasharray={n.you && !joined ? "3 3" : undefined} className={n.you && joined ? "node-pop" : undefined} />
            <text x="100" y={y + 3.5} textAnchor="middle" fontSize={n.you ? 8.5 : 9.5} fontWeight="600" fill={n.you ? (joined ? "#fff" : "#737373") : "#fff"}>
              {n.label}
            </text>
          </g>
        );
      })}
      {n_label(me, joined, 20 + (nodes.length - 1) * step)}

      {/* shared container / desk */}
      <g>
        <rect x={cx - 52} y={cy - 30} width="104" height="60" rx="8" fill="#fff" stroke="#171717" strokeWidth="1.5" />
        <clipPath id="fill-clip">
          <rect x={cx - 50} y={cy - 28} width="100" height="56" rx="6" />
        </clipPath>
        <rect clipPath="url(#fill-clip)" x={cx - 50} y={cy - 28} height="56" fill={THEME} opacity="0.14" className="fill-grow" style={{ width: 100 * f }} />
        {goods && [0, 1, 2, 3, 4].map((k) => <line key={k} x1={cx - 34 + k * 17} x2={cx - 34 + k * 17} y1={cy - 22} y2={cy + 22} stroke="#e5e5e5" />)}
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="11" fontWeight="600" fill="#171717">
          {goods ? "One container" : "One shared desk"}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="10" fill="#737373">
          {Math.round(f * 100)}% {goods ? "full" : "joined"}
        </text>
      </g>

      {/* to market */}
      <path d={`M ${cx + 52} ${cy} L ${W - 62} ${cy}`} stroke="#171717" strokeWidth="2" fill="none" />
      <path d={`M ${cx + 52} ${cy} L ${W - 62} ${cy}`} stroke={THEME} strokeWidth="2" fill="none" className="flow" />
      <path d={`M ${W - 70} ${cy - 5} L ${W - 62} ${cy} L ${W - 70} ${cy + 5}`} stroke="#171717" strokeWidth="2" fill="none" strokeLinecap="round" />
      <rect x={W - 56} y={cy - 16} width="46" height="32" rx="7" fill="#171717" />
      <text x={W - 33} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#fff">
        {country}
      </text>
    </svg>
  );
}

function n_label(me, joined, y) {
  return (
    <text x="82" y={y + 4} textAnchor="end" fontSize="10" fill={joined ? THEME : "#a3a3a3"} fontWeight={joined ? 600 : 400}>
      {joined ? me : "your spot"}
    </text>
  );
}

/**
 * After joining: ONE drafted quote request for the whole group (fixed template on the backend, never sent)
 * plus three real CIFFA-member forwarders to send it to. Portage makes the match; the forwarder ships.
 */
function FreightQuote({ market, cohort, myKg, myProvince, category }) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState(null);
  const [fw, setFw] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false); // first draft arrived: bring it into view once (not on every slider change)
  const [quoteRef, titleRef] = useReveal(ready);
  const code = market.entry.country_code;
  const producers = cohort.length + 1;
  const combinedKg = cohort.reduce((a, m) => a + (m.kg ?? 0), 0) + myKg;
  const provinces = [...cohort.map((m) => m.prov), provinceCode(myProvince)].filter(Boolean);
  const provKey = provinces.join(",");

  useEffect(() => {
    let live = true;
    setError(null);
    Promise.all([
      api.groupQuote({ country_code: code, producers, combined_kg: combinedKg, provinces, ...(category && category !== "honey" ? { category } : {}) }),
      api.forwarders(code, category),
    ])
      .then(([d, f]) => live && (setDraft(d), setFw(f), setReady(true)))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, producers, combinedKg, provKey, category]);

  async function copy() {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${draft.subject}\n\n${draft.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <section ref={quoteRef} className="pop scroll-mt-6 rounded-2xl border border-neutral-200 p-4" aria-labelledby="freight-quote-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 ref={titleRef} tabIndex={-1} id="freight-quote-title" className="text-sm font-semibold outline-none">
          Request freight quotes for the group
        </h4>
        <span className="flex flex-wrap gap-1.5">
          <Badge tone="accent">Preview: sample group</Badge>
          <Badge tone="outline">Draft: nothing is sent</Badge>
        </span>
      </div>
      <p className="mt-1 text-xs text-neutral-500">
        One request for all {producers} producers ({(combinedKg / 1000).toFixed(1)} t combined), from your group coordinator. The forwarder ships;
        Portage only makes the match.
      </p>

      {error && <p className="mt-3 text-sm text-red-700">Couldn't load the draft: {error}</p>}

      {draft && (
        <>
          <p className="mt-3 text-sm">
            <span className="text-neutral-500">Subject </span>
            {draft.subject}
          </p>
          <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 font-sans text-sm leading-relaxed text-neutral-800">
            {draft.body}
          </pre>
          <div className="mt-2 flex justify-end">
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? "Copied" : "Copy email"}
            </Button>
          </div>
        </>
      )}

      {fw && (
        <div className="mt-4">
          <h5 className="text-sm font-semibold">Send it to a CIFFA-member forwarder</h5>
          <ul className="mt-2 divide-y divide-neutral-100 rounded-lg border border-neutral-200">
            {fw.forwarders.map((f) => (
              <li key={f.id} className="px-3 py-2.5">
                <div className="text-sm font-medium">{f.name}</div>
                <div className="text-xs text-neutral-500">{f.why}</div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <a href={f.lcl_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-neutral-900">
                    Shared-container (LCL) service
                  </a>
                  <a href={f.contact_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-neutral-900">
                    Request a quote
                  </a>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-neutral-500">{fw.confirm_note}</p>
          <p className="mt-1 text-[11px] text-neutral-400">
            Listed from the CIFFA 2024 membership directory, as of {fw.as_of}. Public company pages only. Portage isn't paid to list these forwarders.
          </p>
        </div>
      )}
    </section>
  );
}

const PROVINCE_CODES = {
  alberta: "AB", saskatchewan: "SK", manitoba: "MB", "british columbia": "BC", ontario: "ON", quebec: "QC", québec: "QC",
  "nova scotia": "NS", "new brunswick": "NB", "prince edward island": "PE", "newfoundland and labrador": "NL",
};
function provinceCode(p) {
  if (!p) return null;
  return p.length === 2 ? p.toUpperCase() : PROVINCE_CODES[p.toLowerCase()] ?? null;
}
