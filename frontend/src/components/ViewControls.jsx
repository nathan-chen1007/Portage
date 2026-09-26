import { VIEWS } from "../lib/format.js";

/** Toggle between the three rankings, plus the quick-wins ↔ biggest-prize slider for the recommended view. */
export function ViewControls({ view, onView, prize, onPrize, busy }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div role="radiogroup" aria-label="Rank markets by" className="inline-flex rounded-lg bg-neutral-100 p-1">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="radio"
            aria-checked={view === v.key}
            title={v.help}
            onClick={() => onView(v.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              view === v.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === "overall" && (
        <label className="flex min-w-[16rem] flex-1 items-center gap-3 text-xs text-neutral-500 sm:max-w-sm">
          <span className="shrink-0">Quick wins</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={prize}
            aria-label="Quick wins versus biggest prize"
            onChange={(e) => onPrize(Number(e.target.value))}
            className="w-full accent-neutral-900"
          />
          <span className="shrink-0">Biggest prize</span>
          {busy && <span className="sr-only">Re-ranking</span>}
        </label>
      )}
    </div>
  );
}
