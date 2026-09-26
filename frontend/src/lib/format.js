// Display helpers shared by the components.

// Friction components in a fixed colour order (CVD-checked categorical palette). Weights mirror DEFAULT_WEIGHTS.
export const COMPONENTS = [
  {
    key: "tariff",
    label: "Tariffs",
    color: "#2a78d6",
    weight: 0.35,
    help: "Duty a Canadian exporter pays at the border (50% = maximum friction).",
    method: "Applied tariff ÷ 50%, capped at 1. Fifty percent is the highest rate currently applied to Canadian goods, so it counts as maximum friction.",
    factors: [],
  },
  {
    key: "compliance",
    label: "Compliance",
    color: "#eb6834",
    weight: 0.3,
    help: "Rules to clear first, weighted by effort, plus the weeks you wait before the first shipment.",
    method: "60% effort of the required steps (paperwork 1, registration 2, licence 3; summed ÷ 8) + 40% lead time (weeks to the first legal shipment ÷ 26).",
    factors: ["tiers", "lead_time"],
  },
  {
    key: "logistics",
    label: "Logistics",
    color: "#1baf7a",
    weight: 0.15,
    help: "Distance by sea, how often ships sail, and how smoothly customs clears.",
    method: "50% sea distance (÷ 10,000 nm) + 25% gaps between sailings (4+ a week = none) + 25% customs efficiency (World Bank LPI). Goods only.",
    factors: ["distance", "sailings", "customs"],
  },
  {
    key: "risk",
    label: "Risk",
    color: "#8a5cd6",
    weight: 0.1,
    help: "Currency swings against CAD and the risk of not getting paid (OECD country risk).",
    method: "60% currency volatility against CAD (÷ 10% a year, Bank of Canada) + 40% OECD country risk class (÷ 7).",
    factors: ["fx", "country_risk"],
  },
  {
    key: "tax",
    label: "Tax",
    color: "#eda100",
    weight: 0.1,
    help: "Whether you must register for or collect tax in that market.",
    method: "0 when the importer or customer handles tax, 0.5 when you must register above a threshold, 1 when you must from the first sale.",
    factors: [],
  },
];

export const FACTOR_LABELS = {
  tiers: "Effort of the steps",
  lead_time: "Lead time",
  distance: "Sea distance",
  sailings: "Gaps between sailings",
  customs: "Customs clearance",
  fx: "Currency swings",
  country_risk: "Country risk",
};

export const OPPORTUNITY_LABELS = {
  demand: "Import demand",
  price: "Price after tariff",
  growth: "Growth",
  foothold: "Canada's foothold",
};

export const LANGUAGE_NAMES = {
  en: "English",
  de: "German",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  zh: "Chinese",
  fr: "French",
};

export const TIER_LABEL = { 1: "Paperwork", 2: "Registration", 3: "Licence / approval" };

export function flag(code) {
  if (!code || code.length !== 2) return "";
  return code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function pct(x, digits = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return `${(x * 100).toFixed(digits)}%`;
}

export function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function component(key) {
  return COMPONENTS.find((c) => c.key === key);
}

export function componentLabel(key) {
  return component(key)?.label ?? key;
}

// The three ways to rank markets (see docs/SCORING.md).
export const VIEWS = [
  { key: "overall", label: "Recommended", title: "Where to go first", help: "Opportunity and ease combined. Higher is better." },
  { key: "friction", label: "Easiest", title: "Easiest to enter", help: "Friction score 0–100. Lower means fewer barriers." },
  { key: "opportunity", label: "Biggest prize", title: "Most worth entering", help: "Import demand, price after tariff, growth and Canada's foothold. Higher is better." },
];

/** The number a market shows under a view; falls back to friction when that score isn't available. */
export function viewScore(market, view) {
  if (view === "opportunity" && market.opportunity != null) return market.opportunity;
  if (view === "overall" && market.overall != null) return market.overall;
  return market.score;
}

export function usd(x) {
  if (x === null || x === undefined) return "–";
  if (x >= 1e9) return `$${(x / 1e9).toFixed(1)}B`;
  if (x >= 1e6) return `$${Math.round(x / 1e6)}M`;
  if (x >= 1e3) return `$${Math.round(x / 1e3)}K`;
  return `$${Math.round(x)}`;
}

export function weeks(n) {
  if (n === null || n === undefined) return "–";
  if (n === 0) return "Ready now";
  return `${n} week${n === 1 ? "" : "s"}`;
}

export function nm(n) {
  if (n === null || n === undefined) return "–";
  if (n === 0) return "Land border";
  return `${n.toLocaleString()} nm`;
}

/** Short agreement name: the acronym in brackets if there is one ("… (CUKTCA)"), else the text before any bracket. */
export function agreementShort(a) {
  if (!a) return "";
  const m = a.match(/\(([A-Z][A-Z0-9-]{2,})\)/);
  return m ? m[1] : a.split(" (")[0];
}
