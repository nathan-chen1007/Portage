// "More markets": 8 extra markets (FR, NL, IT, VN, SG, NZ, IN, AE) with tariffs and trade data only.
// Deliberately NOT part of the Recommended ranking: no rank numbers, no ease or overall score (compliance, shipping
// and risk aren't verified, so any ease number would flatter them), a red "Not verified" badge on every row, and
// no paperwork / outreach / Ship together. Clicking a row shows its numbers and sources only.
// Renders nothing for services, unknown products, or when the backend doesn't serve /api/more-markets yet.
import { useEffect, useState } from "react";
import { API_URL } from "../lib/api.js";
import { ConfidenceBadge } from "./Confidence.jsx";

const CATEGORY_HS6 = { honey: "040900", icewine: "220421" };

export function hs6For(hsCode, category) {
  const digits = String(hsCode ?? "").replace(/\D/g, "");
  if (digits.length >= 6) return digits.slice(0, 6);
  return CATEGORY_HS6[category] ?? null;
}

const pct = (x) => (x == null ? "–" : `${(Math.round(x * 1000) / 10).toString()}%`);
const usd = (x) =>
  x == null ? "–" : x >= 1e9 ? `$${(x / 1e9).toFixed(1)}B` : x >= 1e6 ? `$${(x / 1e6).toFixed(1)}M` : `$${Math.round(x / 1e3)}k`;
export function sourceLabel(u) {
  if (u.includes("wits.worldbank.org")) return u.includes("/partner/124/") ? "WITS/TRAINS: tariff for Canada" : "WITS/TRAINS: MFN tariff";
  if (u.includes("comtradeapi.un.org")) {
    const q = new URLSearchParams(u.split("?")[1] ?? "");
    return q.get("flowCode") === "X" ? `UN Comtrade: Canada's exports ${q.get("period")}` : `UN Comtrade: imports ${q.get("period")}`;
  }
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
}

export function MoreMarkets({ hsCode, category }) {
  const hs6 = hs6For(hsCode, category);
  const [data, setData] = useState(null);
  const [state, setState] = useState("idle"); // idle | loading | ok | hidden
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!hs6) return undefined;
    let alive = true;
    setState("loading");
    setOpen(null);
    fetch(`${API_URL}/api/more-markets?hs6=${hs6}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        if (!d?.markets?.length) return setState("hidden");
        setData(d);
        setState("ok");
      })
      .catch(() => alive && setState("hidden"));
    return () => {
      alive = false;
    };
  }, [hs6]);

  if (!hs6 || state === "hidden" || state === "idle") return null;

  return (
    <section
      aria-labelledby="more-markets-title"
      data-testid="more-markets"
      className="mt-6 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-3"
    >
      <h3 id="more-markets-title" className="text-sm font-semibold text-neutral-800">
        More markets: tariffs and trade data only
      </h3>
      <p className="mt-1 text-[11px] leading-snug text-neutral-500">
        Not part of the Recommended ranking above. {data?.scale_note}
      </p>
      {state === "loading" && <p className="mt-2 text-xs text-neutral-500">Loading more markets…</p>}
      {state === "ok" && (
        <ul className="mt-2 space-y-1.5">
          {data.markets.map((m) => (
            <li key={m.country_code} className="rounded-lg border border-neutral-200 bg-white">
              <button
                type="button"
                aria-expanded={open === m.country_code}
                onClick={() => setOpen(open === m.country_code ? null : m.country_code)}
                className="w-full px-2.5 py-2 text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-neutral-800">{m.country}</span>
                  <span className="text-[11px] text-neutral-500">
                    {m.status === "blocked" ? "Not accessible" : m.opportunity == null ? "Opportunity –" : `Opportunity ${Math.round(m.opportunity)}/100`}
                  </span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-600">
                  {m.tariff.applied == null ? (
                    <span>{m.tariff.status === "pending" ? "Tariff loading" : "Tariff unavailable"}</span>
                  ) : (
                    <span>
                      Tariff {pct(m.tariff.applied)} ({m.tariff.year})
                    </span>
                  )}
                  <span className="text-neutral-400"> · </span>
                  <span>{m.agreement_in_force ? `Agreement: ${m.agreement_in_force}` : "No trade agreement with Canada"}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <ConfidenceBadge level={m.compliance_confidence ?? "unknown"} />
                  {m.compliance_note && <span className="text-[11px] text-neutral-500">{m.compliance_note}</span>}
                </div>
              </button>
              {open === m.country_code && <Details m={m} data={data} />}
            </li>
          ))}
        </ul>
      )}
      {state === "ok" && data.notes?.length > 0 && (
        <ul className="mt-2 list-disc pl-4 text-[11px] text-neutral-500">
          {data.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Details({ m, data }) {
  const f = m.opportunity_facts;
  return (
    <div data-testid={`more-details-${m.country_code}`} className="border-t border-neutral-100 px-2.5 py-2 text-[11px] leading-snug text-neutral-700">
      {m.status === "blocked" && <p className="mb-1.5 font-medium text-red-700">{m.status_note}</p>}
      <p>
        <span className="font-medium">Tariff: </span>
        {m.tariff.note}
        {m.tariff.fetched && ` Fetched ${m.tariff.fetched}.`}
      </p>
      {m.tariff.applied != null && m.tariff.mfn != null && m.tariff.mfn !== m.tariff.applied && (
        <p className="mt-1">Without an agreement (MFN): {pct(m.tariff.mfn)}</p>
      )}
      {f ? (
        <dl className="mt-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5">
          <dt className="text-neutral-500">Imports {f.year}</dt>
          <dd>{usd(f.import_value_usd)}</dd>
          <dt className="text-neutral-500">Growth {f.growth_years}</dt>
          <dd>{pct(f.growth_rate)}/yr</dd>
          <dt className="text-neutral-500">Canada's share</dt>
          <dd>{pct(f.canada_share)}</dd>
          <dt className="text-neutral-500">Price after tariff</dt>
          <dd>
            {f.import_volume_kg > 0
              ? `$${f.net_unit_value_usd_kg}/kg (Canada $${f.canada_unit_value_usd_kg}/kg)`
              : "No weight reported"}
          </dd>
        </dl>
      ) : (
        <p className="mt-1">{m.opportunity_note}</p>
      )}
      {f && m.opportunity_note && <p className="mt-1">{m.opportunity_note}</p>}
      {m.requirements?.length > 0 && (
        <>
          <p className="mt-1.5 font-medium">Requirements ({m.compliance_note || "verified"})</p>
          <ul className="mt-0.5 space-y-1">
            {m.requirements.map((r) => (
              <li key={r.name}>
                <span className="font-medium">{r.name}.</span> {r.detail}{" "}
                <a href={r.source} target="_blank" rel="noreferrer" className="text-sky-700 underline">
                  {sourceLabel(r.source)}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-1.5 text-neutral-500">{m.ease_note}</p>
      <p className="mt-1.5 font-medium">Sources (as of {data.as_of})</p>
      <ul className="mt-0.5 space-y-0.5">
        {m.sources.map((s) => (
          <li key={s} className="truncate">
            <a href={s} target="_blank" rel="noreferrer" className="text-sky-700 underline" title={s}>
              {sourceLabel(s)}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MoreMarkets;
