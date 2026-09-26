import { useMemo, useState } from "react";
import { Badge, Button, Slider } from "./ui.jsx";
import { CONTAINER_KG, UNITY_RED, cad, freightEstimate, sampleCohort, sharedCosts } from "../lib/together.js";

/**
 * "Ship together" (PREVIEW, sample data): small Canadian exporters heading to the same market pool one
 * shipment and split the fixed costs. Theme: strength through unity.
 */
export function ShipTogether({ market, kind, profile }) {
  const goods = kind === "goods";
  const cohort = useMemo(() => sampleCohort(market, kind), [market, kind]);
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

  const me = profile?.company_name || (goods ? "Your apiary" : "Your company");

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
          <Badge tone="accent">Preview · sample producers</Badge>
          <span className="text-xs text-neutral-500">
            {provinces.length} provinces · {others} {goods ? "producers" : "companies"} heading to {country}
          </span>
        </div>
        <h3 className="mt-3 text-2xl font-semibold tracking-tight">
          <span style={{ color: UNITY_RED }}>Canada</span> is stronger together.
        </h3>
        <p className="mt-1 max-w-xl text-sm text-neutral-600">
          {goods
            ? `One small producer can't fill a container. ${withMe} Canadian producers heading to ${country} can, and they split the broker, the certificates and the freight.`
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
                <>
                  <span className="line-through">${f.solo.toFixed(2)} alone</span> ·{" "}
                  <span className="font-semibold" style={{ color: UNITY_RED }}>
                    −{Math.round(saving * 100)}%
                  </span>
                </>
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
              <li className="pop flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: UNITY_RED }}>
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
              <Slider value={myKg} min={500} max={5000} step={100} onChange={setMyKg} color={UNITY_RED} label="Your shipment in kilograms" className="mt-1" />
            </div>
          )}
          {joined ? (
            <div className="pop text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full text-white" style={{ background: UNITY_RED }}>
                <svg viewBox="0 0 20 20" className="h-5 w-5" aria-hidden>
                  <path d="M5 10.5l3 3L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mt-2 text-sm font-semibold">You're in.</p>
              <p className="text-xs font-medium" style={{ color: UNITY_RED }}>
                Canada is stronger together.
              </p>
              <p className="text-xs text-neutral-500">
                {withMe} {goods ? "producers" : "companies"} from {new Set([...provinces, profile?.province].filter(Boolean)).size} provinces, one{" "}
                {goods ? "shipment" : "team"} to {country}.
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
              <Button size="lg" className="w-full hover:opacity-90" style={{ background: UNITY_RED }} onClick={() => setJoined(true)}>
                {goods ? "Join this shipment" : "Join this group"}
              </Button>
              <p className="mt-2 text-center text-xs text-neutral-500">Free to join. Nothing is booked until everyone confirms.</p>
            </>
          )}
        </div>
      </div>

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
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${meter * 100}%`, background: UNITY_RED }} />
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
            <path d={d} fill="none" stroke={n.you ? (joined ? UNITY_RED : "#d4d4d4") : "#e5e5e5"} strokeWidth={n.you && joined ? 2 : 1.5} strokeDasharray={n.you && !joined ? "4 4" : undefined} />
            {active && <path d={d} fill="none" stroke={n.you ? UNITY_RED : "#404040"} strokeWidth="1.5" className="flow" style={{ animationDelay: `${i * 0.15}s` }} />}
            <circle cx="100" cy={y} r={n.you ? 13 : 11.5} fill={n.you ? (joined ? UNITY_RED : "#fff") : "#171717"} stroke={n.you ? (joined ? UNITY_RED : "#a3a3a3") : "#171717"} strokeWidth="1.5" strokeDasharray={n.you && !joined ? "3 3" : undefined} className={n.you && joined ? "node-pop" : undefined} />
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
        <rect clipPath="url(#fill-clip)" x={cx - 50} y={cy - 28} height="56" fill={UNITY_RED} opacity="0.14" className="fill-grow" style={{ width: 100 * f }} />
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
      <path d={`M ${cx + 52} ${cy} L ${W - 62} ${cy}`} stroke={UNITY_RED} strokeWidth="2" fill="none" className="flow" />
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
    <text x="82" y={y + 4} textAnchor="end" fontSize="10" fill={joined ? UNITY_RED : "#a3a3a3"} fontWeight={joined ? 600 : 400}>
      {joined ? me : "your spot"}
    </text>
  );
}
