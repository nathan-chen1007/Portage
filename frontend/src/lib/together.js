// "Ship together" PREVIEW: sample producers and illustrative economics.
// Nothing here is live data. The UI labels it as a preview everywhere it appears.

export const UNITY_RED = "#d52b1e";
export const CONTAINER_KG = 20000; // a 20 ft container holds roughly 20 t of drummed honey

// Deterministic pseudo-random so the same market always shows the same sample cohort.
function seeded(str) {
  let h = 2166136261;
  for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// Prairie towns: the Prairies ship about 77% of Canada's honey exports (AAFC 2024), and the demo group is a Prairie group.
const GOODS_PLACES = [
  ["Peace River", "AB"],
  ["Falher", "AB"],
  ["Grande Prairie", "AB"],
  ["Tisdale", "SK"],
  ["Nipawin", "SK"],
  ["Melfort", "SK"],
  ["Dauphin", "MB"],
  ["Swan River", "MB"],
  ["Brooks", "AB"],
  ["Carman", "MB"],
];
const GOODS_KINDS = ["Family apiary", "Beekeeping co-op", "Honey packer", "Apiary", "Meadery"];

// Icewine regions: Niagara (Ontario), the Okanagan (British Columbia) and Nova Scotia (sample group).
const ICEWINE_PLACES = [
  ["Niagara-on-the-Lake", "ON"],
  ["Beamsville", "ON"],
  ["Jordan Station", "ON"],
  ["Vineland", "ON"],
  ["St. Catharines", "ON"],
  ["Kelowna", "BC"],
  ["Oliver", "BC"],
  ["Osoyoos", "BC"],
  ["Penticton", "BC"],
  ["Wolfville", "NS"],
];
const ICEWINE_KINDS = ["Estate winery", "Family winery", "Icewine producer", "Craft winery", "Vineyard and winery"];

// Goods sample groups per curated category (honey keeps its original seed, so its cohort is unchanged).
const GOODS = {
  honey: { places: GOODS_PLACES, kinds: GOODS_KINDS, seed: "goods", kgBase: 1, kgSpan: 3.5, me: "Your apiary" },
  icewine: { places: ICEWINE_PLACES, kinds: ICEWINE_KINDS, seed: "icewine", kgBase: 0.4, kgSpan: 1.6, me: "Your winery" },
};

/** Name for the founder's own business in the sample group. */
export function ownLabel(kind, category) {
  return kind === "goods" ? (GOODS[category] ?? GOODS.honey).me : "Your company";
}

const SERVICE_PLACES = [
  ["Waterloo", "ON"],
  ["Toronto", "ON"],
  ["Montréal", "QC"],
  ["Vancouver", "BC"],
  ["Calgary", "AB"],
  ["Halifax", "NS"],
  ["Ottawa", "ON"],
  ["Saskatoon", "SK"],
];
const SERVICE_KINDS = ["HR software", "Scheduling SaaS", "CRM startup", "Analytics platform", "Payroll tool", "Support desk software"];

/** Sample cohort of Canadian businesses also heading to this market (preview only). */
export function sampleCohort(market, kind, category = "honey") {
  const goods = kind === "goods";
  const g = GOODS[category] ?? GOODS.honey;
  const rnd = seeded(`${goods ? g.seed : kind}:${market.country_code}`);
  const places = goods ? g.places : SERVICE_PLACES;
  const kinds = goods ? g.kinds : SERVICE_KINDS;
  const n = 4 + Math.floor(rnd() * 4); // 4-7 others
  const used = new Set();
  const members = [];
  while (members.length < n) {
    const i = Math.floor(rnd() * places.length);
    if (used.has(i)) continue;
    used.add(i);
    const [town, prov] = places[i];
    members.push({
      id: `${market.country_code}-${i}`,
      name: kinds[Math.floor(rnd() * kinds.length)],
      town,
      prov,
      kg: goods ? Math.round((g.kgBase + rnd() * g.kgSpan) * 10) * 100 : null, // honey 1-4.5 t, icewine 0.4-2 t
      joinedDaysAgo: 1 + Math.floor(rnd() * 20),
    });
  }
  return members;
}

/** Illustrative per-kg freight: less-than-container alone vs a shared full container. USD. */
export function freightEstimate(market) {
  const nm = market.entry.sea_distance_nm ?? 4000;
  const solo = 0.14 + nm * 0.000055; // LCL: pay by volume, plus per-shipment handling
  const pooled = (1300 + nm * 0.32) / CONTAINER_KG; // FCL split by weight
  return { solo, pooled, saving: 1 - pooled / solo };
}

/** Fixed costs every exporter pays once per shipment/market, which a group can share. Illustrative, CAD. */
export function sharedCosts(market, kind) {
  if (kind !== "goods") {
    return [
      { label: "Local legal representative (a year)", solo: 2400 },
      { label: "Privacy contract review", solo: 3000 },
      { label: "Trade-show booth", solo: 6000 },
    ];
  }
  const rows = [
    { label: "Customs broker", solo: 450 },
    { label: "Export certificate and inspection", solo: 300 },
  ];
  const text = market.entry.compliance_requirements.map((r) => r.name).join(" ").toLowerCase();
  if (/list|registration|register/.test(text)) rows.push({ label: "Registration paperwork (consultant)", solo: 1200 });
  if (/label/.test(text)) rows.push({ label: "Translated label design", solo: 800 });
  return rows;
}

export function cad(n) {
  return `$${Math.round(n).toLocaleString()}`;
}
