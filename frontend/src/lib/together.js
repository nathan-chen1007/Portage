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

const GOODS_PLACES = [
  ["Peace River", "AB"],
  ["Falher", "AB"],
  ["Tisdale", "SK"],
  ["Nipawin", "SK"],
  ["Dauphin", "MB"],
  ["Swan River", "MB"],
  ["Vernon", "BC"],
  ["Guelph", "ON"],
  ["Lac-Mégantic", "QC"],
  ["Charlottetown", "PE"],
];
const GOODS_KINDS = ["Family apiary", "Beekeeping co-op", "Honey packer", "Apiary", "Meadery"];

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
export function sampleCohort(market, kind) {
  const rnd = seeded(`${kind}:${market.country_code}`);
  const goods = kind === "goods";
  const places = goods ? GOODS_PLACES : SERVICE_PLACES;
  const kinds = goods ? GOODS_KINDS : SERVICE_KINDS;
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
      kg: goods ? Math.round((1 + rnd() * 3.5) * 10) * 100 : null, // 1-4.5 t
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

// ---------- freight quote request (PREVIEW: fixed template, never sent) ----------

const DEST_PORT = {
  JP: "Port of Tokyo / Yokohama",
  GB: "Liverpool or Felixstowe",
  DE: "Hamburg",
  AU: "Sydney",
  KR: "Busan",
  CN: "Shanghai",
};
const PRAIRIES = new Set(["AB", "SK", "MB"]);

/**
 * Deterministic quote-request email from Portage, on behalf of the group, to a generic CIFFA-certified
 * forwarder. No LLM, no real company named, nothing sent: the UI only offers a Copy button.
 */
export function freightQuoteEmail({ market, cohort, myKg, myProvince }) {
  const e = market.entry;
  const country = e.country.replace(" (EU)", "");
  const land = (e.sea_distance_nm ?? 1) === 0;
  const gateway = (e.shipping_route || "").split("→")[0].trim() || "Vancouver";
  const dest = DEST_PORT[e.country_code] ?? country;
  const producers = cohort.length + 1;
  const kg = cohort.reduce((a, m) => a + (m.kg ?? 0), 0) + myKg;
  const provs = [...new Set([...cohort.map((m) => m.prov), myProvince].filter(Boolean))];
  const prairieKg = cohort.filter((m) => PRAIRIES.has(m.prov)).reduce((a, m) => a + m.kg, 0) + (PRAIRIES.has(myProvince) ? myKg : 0);
  const fill = Math.round((Math.min(kg, CONTAINER_KG) / CONTAINER_KG) * 100);

  const route = land ? `the Prairies → ${country} by truck` : `${gateway} → ${dest}, ${country}`;
  const service = land
    ? "LTL consolidation (combining the producers' loads on one truck)"
    : "LCL consolidation (combining the producers' small loads into one container)";
  const recipient = land
    ? `CIFFA-certified freight forwarder, Prairies → ${country}`
    : `CIFFA-certified freight forwarder, ${gateway} → ${country}`;

  const subject = `Quote request: ${land ? "LTL" : "LCL"} consolidation, natural honey (HS 0409.00), ${route} — ${producers} Canadian producers`;
  const body = [
    "Hello,",
    "",
    `I'm writing from Portage on behalf of a group of ${producers} small Canadian honey producers who want to ship to ${country} together. Portage matches exporters heading to the same market; we don't book or ship cargo ourselves, so we're looking for a forwarder to handle the group's shipment.`,
    "",
    "Shipment details",
    "- Product: natural honey, HS 0409.00 (food grade, in drums and retail cases)",
    `- Combined volume: about ${(kg / 1000).toFixed(1)} t (${kg.toLocaleString()} kg) from ${producers} producers${land ? "" : `, roughly ${fill}% of a 20 ft container`}`,
    `- Origin: producers in ${provs.join(", ")}${prairieKg > kg / 2 ? ", most of the volume from the Prairies" : ""}; pickup or delivery to a consolidation point to be agreed`,
    `- Route: ${route}`,
    `- Service: ${service}`,
    "- Paperwork: each producer holds its own CFIA export certificate for its lot",
    "",
    "Could you quote:",
    "1. Price (per kg or per shipment), and how it's split across the shippers",
    "2. Transit time and sailing (or departure) schedule",
    "3. Cargo insurance options",
    "4. Document handling: commercial invoices, packing lists, origin declarations, certificates, and customs clearance at destination",
    "",
    "We're planning a first shipment in [month]. Happy to set up a call.",
    "",
    "Thank you,",
    `Portage, on behalf of the ${country} honey group`,
    "[contact email]",
    "",
    "Growing Canada, together.",
  ].join("\n");

  return { recipient, subject, body, producers, kg };
}
