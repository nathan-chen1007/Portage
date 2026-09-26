import { CountryMark, Icon, Meter, Slider } from "./ui.jsx";
import { FACTOR_LABELS, component, earned } from "../lib/format.js";

/** One factor across every market: what it measures, its weight (adjustable here), and a ranking by it (best first). */
export function FactorPanel({ factorKey, markets, weights, onWeight, onPickMarket, onClose }) {
  const c = component(factorKey);
  if (!c) return null;
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const open = markets.filter((m) => m.status !== "blocked");
  const blocked = markets.filter((m) => m.status === "blocked");
  const sorted = [...open].sort((a, b) => (a.components?.[factorKey] ?? 0) - (b.components?.[factorKey] ?? 0));
  const maxPts = earned(null, factorKey, weights).max;

  return (
    <section className="slide-in" aria-labelledby="factor-title">
      <button type="button" onClick={onClose} className="mb-4 flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-neutral-900">
        <Icon name="back" className="h-3.5 w-3.5" /> Back to market
      </button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 id="factor-title" className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
            <span className="h-3 w-3 rounded-full" style={{ background: c.color }} />
            {c.label}
          </h2>
          <p className="mt-2 text-sm text-neutral-600">{c.help}</p>
        </div>
        <div className="w-56 rounded-xl border border-neutral-200 bg-white p-3">
          <div className="flex items-baseline justify-between text-xs text-neutral-500">
            <span>Weight in the score</span>
            <span className="text-base font-semibold tabular-nums text-neutral-900">{Math.round((weights[factorKey] / total) * 100)}%</span>
          </div>
          <Slider value={weights[factorKey]} onChange={(v) => onWeight(factorKey, v)} color={c.color} label={`${c.label} weight`} className="mt-2" />
        </div>
      </header>

      <div className="mt-5 rounded-xl bg-neutral-50 p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">How it's measured</h3>
        <p className="mt-1.5 text-sm text-neutral-700">{c.method}</p>
        <p className="mt-2 text-sm text-neutral-700">
          A market with no {c.label.toLowerCase()} barrier earns all {Math.round(maxPts)} of this factor's ease points; the bigger the barrier, the fewer it earns.
        </p>
        {c.factors.length > 0 && (
          <p className="mt-2 text-xs text-neutral-500">Made of: {c.factors.map((f) => FACTOR_LABELS[f]).join(", ")}.</p>
        )}
      </div>

      <h3 className="mb-2 mt-6 text-sm font-semibold">Markets by {c.label.toLowerCase()} (best first)</h3>
      <ul className="space-y-1">
        {sorted.map((m) => {
          const v = 1 - (m.components?.[factorKey] ?? 0);
          const pts = earned(m, factorKey, weights).points;
          return (
            <li key={m.country_code}>
              <button
                type="button"
                onClick={() => onPickMarket(m.country_code)}
                className="grid w-full grid-cols-[2.25rem_8rem_1fr_3.5rem] items-center gap-3 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-neutral-50"
              >
                <CountryMark code={m.country_code} />
                <span className="truncate font-medium">{m.country}</span>
                <Meter value={v} color={c.color} />
                <span className="text-right text-xs tabular-nums text-neutral-500">
                  {Math.round(pts)} / {Math.round(maxPts)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {blocked.length > 0 && (
        <p className="mt-3 text-xs text-neutral-400">Not scored (market closed): {blocked.map((m) => m.country).join(", ")}.</p>
      )}
    </section>
  );
}
