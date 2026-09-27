// "Help you may qualify for": Canadian export-support programs for this market and product.
// Never a guarantee: each program shows "May qualify", "Likely not eligible" or "Check eligibility" with the reason,
// the official page and an as-of date. Revenue and head count default to "Not sure", which shows the rule instead of
// a verdict. No LLM. Renders nothing if the backend doesn't serve /api/programs.
import { useEffect, useState } from "react";
import { API_URL } from "../lib/api.js";

const STATUS_STYLE = {
  may_qualify: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  check: "bg-amber-50 text-amber-800 ring-amber-300",
  likely_not: "bg-neutral-100 text-neutral-600 ring-neutral-300",
};

const REVENUE = [
  ["unknown", "Not sure"],
  ["under_300k", "Under $300k"],
  ["300k_plus", "$300k+"],
];
const EMPLOYEES = [
  ["unknown", "Not sure"],
  ["1_2", "1–2"],
  ["3_plus", "3+"],
];

const host = (u) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

export function ProgramsPanel({ countryCode, category }) {
  const [revenue, setRevenue] = useState("unknown");
  const [employees, setEmployees] = useState("unknown");
  const [data, setData] = useState(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!countryCode) return undefined;
    let alive = true;
    const q = new URLSearchParams({ country_code: countryCode, revenue, employees });
    if (category) q.set("category", category);
    fetch(`${API_URL}/api/programs?${q}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!alive) return;
        if (!d?.programs?.length) return setHidden(true);
        setData(d);
        setHidden(false);
      })
      .catch(() => alive && setHidden(true));
    return () => {
      alive = false;
    };
  }, [countryCode, category, revenue, employees]);

  if (!countryCode || hidden || !data) return null;

  return (
    <section aria-labelledby="programs-title" data-testid="programs-panel" className="rounded-xl border border-neutral-200 bg-white/80 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="programs-title" className="text-sm font-semibold">
          Help you may qualify for
        </h3>
        <span className="text-[11px] font-medium text-amber-800">{data.label}</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-neutral-600">
        <label className="flex items-center gap-1.5">
          Annual revenue
          <select className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5" value={revenue} onChange={(e) => setRevenue(e.target.value)}>
            {REVENUE.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Full-time employees
          <select className="rounded-md border border-neutral-200 bg-white px-1.5 py-0.5" value={employees} onChange={(e) => setEmployees(e.target.value)}>
            {EMPLOYEES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ul className="mt-3 space-y-2.5">
        {data.programs.map((p) => (
          <li key={p.id} data-testid={`program-${p.id}`} className="text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <a href={p.url} target="_blank" rel="noreferrer" className="font-medium text-neutral-900 underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600">
                {p.name}
              </a>
              <span data-testid={`program-status-${p.id}`} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[p.status] ?? STATUS_STYLE.check}`}>
                {p.status_label}
              </span>
            </div>
            <p className="mt-0.5 text-neutral-600">{p.what}</p>
            <p className="mt-0.5 text-xs text-neutral-500">{p.reason}</p>
            {p.note && <p className="mt-0.5 text-xs text-neutral-500">{p.note}</p>}
            <p className="mt-0.5 text-[11px] text-neutral-400">
              Source: {host(p.url)}, as of {p.as_of}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-neutral-400">{data.note}</p>
    </section>
  );
}

export default ProgramsPanel;
