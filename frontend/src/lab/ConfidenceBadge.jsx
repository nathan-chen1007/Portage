// Compliance confidence, shown next to every lab score. "unknown" must be impossible to miss.
export const CONFIDENCE = {
  verified: { label: "Verified", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200", help: "A person checked the official source." },
  auto_sourced: { label: "Auto-sourced", tone: "bg-sky-50 text-sky-700 ring-sky-200", help: "From an official structured source, not checked by a person for this product." },
  unknown: {
    label: "Compliance not verified",
    tone: "bg-amber-100 text-amber-900 ring-amber-300",
    help: "Compliance not verified — confirm with the Trade Commissioner Service",
  },
};

export function ConfidenceBadge({ value }) {
  const c = CONFIDENCE[value] ?? CONFIDENCE.unknown;
  return (
    <span
      title={c.help}
      data-testid={`confidence-${value}`}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${c.tone}`}
    >
      {value === "unknown" && <span aria-hidden>!</span>}
      {c.label}
    </span>
  );
}
