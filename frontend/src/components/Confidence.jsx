// How much to trust a market's (or a requirement's) compliance data. Shown on every market and requirement.
//   verified      a person read the official source for this product and market (curated data)
//   auto_sourced  official structured data (e.g. the UK Trade Tariff API), not yet checked by a person
//   unknown       no data: Portage assumes a typical burden (never zero) and says so
export const CONFIDENCE = {
  verified: {
    label: "Verified",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    title: "A person checked these requirements against the official source.",
  },
  auto_sourced: {
    label: "Auto-sourced: confirm with CFIA or the Trade Commissioner Service",
    className: "bg-amber-50 text-amber-800 ring-amber-300",
    title: "From official structured data (for example the UK Trade Tariff), not yet checked by a person.",
  },
  unknown: {
    label: "Not verified: confirm with the Trade Commissioner Service",
    className: "bg-red-50 text-red-700 ring-red-200",
    title: "No compliance data for this market yet. Portage assumes a typical burden (an approval and a registration), not zero.",
  },
};

export function ConfidenceBadge({ level, className = "" }) {
  const key = CONFIDENCE[level] ? level : "unknown";
  const c = CONFIDENCE[key];
  return (
    <span
      title={c.title}
      data-testid={`confidence-${key}`}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-snug ring-1 ring-inset ${c.className} ${className}`}
    >
      {key === "unknown" && <span aria-hidden>!</span>}
      {c.label}
    </span>
  );
}
