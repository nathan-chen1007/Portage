// Display helpers shared by the components.

// Categorical slots 1-4 of a CVD-validated palette, always in this fixed order.
export const COMPONENTS = [
  { key: "tariff", label: "Tariffs", color: "#2a78d6", help: "Duty a Canadian exporter pays at the border (50% = maximum friction)." },
  { key: "compliance", label: "Compliance", color: "#eb6834", help: "Rules to clear first: paperwork, registrations, licences, weighted by effort." },
  { key: "customs", label: "Customs", color: "#1baf7a", help: "How smooth clearance is (World Bank Logistics Performance Index)." },
  { key: "tax", label: "Tax", color: "#eda100", help: "Whether you must register for or collect tax in that market." },
];

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

export function componentLabel(key) {
  return COMPONENTS.find((c) => c.key === key)?.label ?? key;
}
