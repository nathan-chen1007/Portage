// Display helpers shared by the components.

// Friction components in a fixed colour order (CVD-checked categorical palette). Weights mirror DEFAULT_WEIGHTS.
export const COMPONENTS = [
  {
    key: "tariff",
    label: "Tariffs",
    color: "#2a78d6",
    weight: 0.35,
    help: "Duty a Canadian exporter pays at the border. No duty earns the full points; 50% or more earns none.",
    method: "Applied tariff ÷ 50%, capped at 1. Fifty percent is the highest rate currently applied to Canadian goods, so a 50% tariff loses every tariff point.",
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
  nl: "Dutch",
  it: "Italian",
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
  { key: "friction", label: "Easiest", title: "Easiest to enter", help: "Ease 0–100: how clear the path in is. Higher means fewer barriers." },
  { key: "opportunity", label: "Biggest opportunity", title: "Most worth entering", help: "Import demand, price after tariff, growth and Canada's foothold. Higher is better." },
];

/** The number a market shows under a view. Every view reads "higher is better"; falls back to ease when a score isn't available. */
export function viewScore(market, view) {
  if (view === "opportunity" && market.opportunity != null) return market.opportunity;
  if (view === "overall" && market.overall != null) return market.overall;
  return ease(market);
}

/*
 * Display convention: the engine scores friction (0-100, lower is easier). On screen we only show
 * "higher is better" numbers, so friction is flipped into ease = 100 - friction, and each factor shows
 * the points it EARNS out of its weight instead of the points it costs. Same algorithm, same ranking.
 */

/** Ease 0-100 (100 - friction). Null for blocked markets. */
export function ease(market) {
  return market?.score == null ? null : Math.max(0, 100 - market.score);
}

/** Weights rescaled to sum to 1 (what the backend does). Falls back to the default weights. */
export function normWeights(weights) {
  const w = weights ?? Object.fromEntries(COMPONENTS.map((c) => [c.key, c.weight]));
  const total = COMPONENTS.reduce((a, c) => a + (w[c.key] ?? 0), 0) || 1;
  return Object.fromEntries(COMPONENTS.map((c) => [c.key, (w[c.key] ?? 0) / total]));
}

/** Ease points a factor earns for a market, and the most it could earn (its weight × 100). */
export function earned(market, key, weights) {
  const max = 100 * normWeights(weights)[key];
  const lost = market?.breakdown?.[key] ?? 0;
  return { points: Math.max(0, max - lost), max };
}

// The four parts of the prize (opportunity) score, with the backend's fixed mix. Shades of the prize teal.
export const PRIZE_PARTS = [
  { key: "demand", short: "demand", label: "Import demand", weight: 0.35, color: "#0f766e" },
  { key: "price", short: "price", label: "Price after tariff", weight: 0.25, color: "#14a39a" },
  { key: "growth", short: "growth", label: "Growth", weight: 0.15, color: "#4fd1c5" },
  { key: "foothold", short: "foothold", label: "Canada's foothold", weight: 0.25, color: "#9fe8dd" },
];

export const EASE_COLOR = "#475569";
export const PRIZE_COLOR = "#0f766e";

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

/** Tariffs at or above this read as a barrier on screen (red). */
export const HIGH_TARIFF = 0.2;

/**
 * The agreement part of a market's tariff line, with the reason when the agreement doesn't help:
 * "CUSMA (does not exempt Section 338 tariffs)" -> "CUSMA does not exempt Section 338 tariffs",
 * "Canada-Korea FTA (CKFTA) — honey excluded" -> "CKFTA: honey excluded", none + a tariff -> "no trade deal".
 */
export function agreementLine(entry) {
  const a = entry?.trade_agreement || "";
  if (!a) return entry?.tariff_rate > 0 ? "no trade deal" : "";
  const short = agreementShort(a);
  const dash = a.split(/\s+[—–-]\s+/)[1];
  if (dash) return `${short}: ${dash}`;
  const caveat = a.match(/\(([a-z][^)]*)\)/)?.[1];
  return caveat ? `${short} ${caveat}` : short;
}

/**
 * Muted red -> amber -> green for a 0-100 "higher is better" score, so the colour says how good it is.
 * Returns a readable text colour and a pastel background from the same hue.
 */
export function scoreTone(v, lo = 25, hi = 85) {
  // Relative to this product's own range: its lowest score is the reddest, its highest the greenest.
  const x = hi > lo ? Math.max(0, Math.min(1, ((v ?? 0) - lo) / (hi - lo))) : 1;
  const hue = Math.round(4 + x * 138); // 4 = soft red, ~45 = amber, 142 = green
  return {
    color: `hsl(${hue} 58% 36%)`,
    background: `hsl(${hue} 78% 93%)`,
    ring: `hsl(${hue} 62% 74%)`,
    glow: `hsl(${hue} 60% 45% / 0.35)`,
    edge: `hsl(${hue} 55% 55%)`,
    inner: `hsl(${hue} 72% 60% / 0.5)`,
  };
}

/** Lowest and highest score among a product's scored markets, for scoreTone's range. */
export function scoreBounds(markets, pick) {
  const vals = (markets ?? []).filter((m) => m.status !== "blocked" && m.score != null).map(pick).filter((v) => v != null);
  return vals.length ? [Math.min(...vals), Math.max(...vals)] : [25, 85];
}
