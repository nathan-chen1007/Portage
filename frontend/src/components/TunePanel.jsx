import { useState } from "react";
import { Button, Icon, Slider, useDismiss } from "./ui.jsx";
import { COMPONENTS } from "../lib/format.js";
import { DEFAULT_WEIGHTS } from "../lib/api.js";

export const PRESETS = [
  { key: "balanced", label: "Balanced", weights: DEFAULT_WEIGHTS },
  { key: "cost", label: "Lowest cost", weights: { tariff: 0.5, compliance: 0.15, logistics: 0.2, risk: 0.05, tax: 0.1 } },
  { key: "speed", label: "Fastest start", weights: { tariff: 0.2, compliance: 0.5, logistics: 0.15, risk: 0.05, tax: 0.1 } },
  { key: "safe", label: "Lowest risk", weights: { tariff: 0.25, compliance: 0.2, logistics: 0.1, risk: 0.35, tax: 0.1 } },
];

function samePreset(a, b) {
  return COMPONENTS.every((c) => Math.abs((a[c.key] ?? 0) - (b[c.key] ?? 0)) < 1e-6);
}

/** "Tune" button with a popover: presets, per-factor weights, and the quick-wins ↔ biggest-opportunity balance. */
export function TunePanel({ weights, onWeights, prize, onPrize, showPrize, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const custom = !PRESETS.some((p) => samePreset(p.weights, weights));

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="dialog">
        <Icon name="sliders" className="h-4 w-4" />
        Tune
        {custom && <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-label="custom weights" />}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Tune the ranking"
          className="pop absolute right-0 z-30 mt-2 w-[22rem] rounded-2xl border border-neutral-200 bg-white p-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">What matters most to you?</h3>
            <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900" aria-label="Close">
              <Icon name="close" className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {PRESETS.map((p) => {
              const on = samePreset(p.weights, weights);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => onWeights(p.weights)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
                    on ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 space-y-3">
            {COMPONENTS.map((c) => (
              <div key={c.key}>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-neutral-700" title={c.help}>
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.label}
                  </span>
                  <span className="tabular-nums text-neutral-500">{Math.round(((weights[c.key] ?? 0) / total) * 100)}%</span>
                </div>
                <Slider
                  value={weights[c.key] ?? 0}
                  onChange={(v) => onWeights({ ...weights, [c.key]: v })}
                  color={c.color}
                  label={`${c.label} weight`}
                />
              </div>
            ))}
          </div>

          {showPrize && (
            <div className="mt-4 border-t border-neutral-100 pt-4">
              <div className="flex justify-between text-xs font-medium text-neutral-700">
                <span>Quick wins</span>
                <span>Biggest opportunity</span>
              </div>
              <Slider value={prize} onChange={onPrize} step={0.1} label="Quick wins versus biggest opportunity" className="mt-1" />
              <p className="text-[11px] text-neutral-400">Balances ease of entry against market size in the Recommended view.</p>
            </div>
          )}

          <p className="mt-3 text-[11px] text-neutral-400">{busy ? "Re-ranking…" : "Rankings update live. Weights are rescaled to 100%."}</p>
        </div>
      )}
    </div>
  );
}
