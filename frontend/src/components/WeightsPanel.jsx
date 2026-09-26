import { COMPONENTS } from "../lib/format.js";
import { Button } from "./ui.jsx";

/** Lets a judge (or founder) change how much each blocker counts. The backend normalizes the weights. */
export function WeightsPanel({ weights, onChange, onReset, busy }) {
  // Weights missing from older defaults fall back to each component's default.
  const w = Object.fromEntries(COMPONENTS.map((c) => [c.key, weights[c.key] ?? c.weight]));
  const total = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return (
    <details className="group rounded-xl border border-neutral-200 px-4 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium">
        <span>Adjust what matters to you</span>
        <span className="text-xs font-normal text-neutral-500 group-open:hidden">Tariffs 35 · Compliance 30 · Logistics 15 · Risk 10 · Tax 10</span>
      </summary>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {COMPONENTS.map((c) => (
          <label key={c.key} className="block text-sm">
            <span className="flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.label}
              </span>
              <span className="tabular-nums text-neutral-500">{Math.round((w[c.key] / total) * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={w[c.key]}
              aria-label={`${c.label} weight`}
              onChange={(e) => onChange({ ...w, [c.key]: Number(e.target.value) })}
              className="mt-1 w-full accent-neutral-900"
            />
            <span className="text-xs text-neutral-400">{c.help}</span>
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-neutral-400">{busy ? "Re-ranking…" : "Rankings update as you move the sliders."}</span>
        <Button variant="ghost" size="sm" onClick={onReset}>
          Reset to defaults
        </Button>
      </div>
    </details>
  );
}
