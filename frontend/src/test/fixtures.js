const entry = (over) => ({
  category: "honey",
  country: "",
  country_code: "",
  language: "en",
  status: "open",
  status_note: "",
  tariff_rate: 0,
  mfn_rate: 0,
  tariff_note: "",
  trade_agreement: null,
  compliance_requirements: [],
  lpi_customs_score: 3.5,
  tax_burden: 0,
  tax_note: "",
  notes: [],
  sources: ["https://example.com/source"],
  as_of: "2026-09-26",
  ...over,
});

export const HONEY = {
  id: "honey",
  label: "Natural honey",
  kind: "goods",
  hs_code: "0409.00",
  description: "Natural honey",
  examples: [],
};

export const MARKETS = [
  {
    country: "United Kingdom",
    country_code: "GB",
    status: "open",
    status_note: "",
    score: 12.4,
    rank: 1,
    components: { tariff: 0, compliance: 0.25, customs: 0.375, tax: 0 },
    breakdown: { tariff: 0, compliance: 8.75, customs: 3.65, tax: 0 },
    top_blocker: "compliance",
    entry: entry({
      country: "United Kingdom",
      country_code: "GB",
      mfn_rate: 0.16,
      trade_agreement: "Canada-UK Trade Continuity Agreement (CUKTCA)",
      compliance_requirements: [
        { name: "CUKTCA origin declaration", tier: 1, detail: "Self-declared on the invoice.", source: "https://example.com/d11" },
      ],
    }),
    middlemen: [
      {
        id: "tcs",
        category: "*",
        country_code: "*",
        name: "Canadian Trade Commissioner Service",
        type: "government (free)",
        description: "Free help finding vetted partners.",
        website: "https://www.tradecommissioner.gc.ca/",
        contact: "Find a trade commissioner",
        source: "https://www.tradecommissioner.gc.ca/",
      },
    ],
  },
  {
    country: "United States",
    country_code: "US",
    status: "open",
    status_note: "",
    score: 66.8,
    rank: 2,
    components: { tariff: 1, compliance: 0.625, customs: 0.325, tax: 0 },
    breakdown: { tariff: 40, compliance: 21.88, customs: 4.88, tax: 0 },
    top_blocker: "tariff",
    entry: entry({ country: "United States", country_code: "US", tariff_rate: 0.5, trade_agreement: "CUSMA (does not exempt Section 338 tariffs)" }),
    middlemen: [],
  },
  {
    country: "Mexico",
    country_code: "MX",
    status: "blocked",
    status_note: "Canada does not meet Mexico's requirements for exporting honey. No certificate is currently available.",
    score: null,
    rank: 3,
    components: {},
    breakdown: {},
    top_blocker: null,
    entry: entry({ country: "Mexico", country_code: "MX", language: "es", status: "blocked" }),
    middlemen: [],
  },
];

export const PROFILE = {
  company_name: "Prairie Gold Apiaries",
  product_name: "Creamed clover honey",
  product_summary: "Raw creamed honey",
  category: "honey",
  category_reason: "honey",
  city: "Falher",
  province: "AB",
  selling_points: [],
  contact_name: "Dana Morin",
  contact_email: "dana@prairiegold.ca",
  website: "",
  business_number: "",
};

/** Build a fetch mock that answers by path. Unknown paths return 404. */
export function mockFetch(routes) {
  return vi.fn(async (url, init) => {
    const path = new URL(url).pathname;
    const handler = routes[path];
    if (!handler) return new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 });
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const out = typeof handler === "function" ? handler(body) : handler;
    const status = out?.__status ?? 200;
    return new Response(JSON.stringify(out?.__body ?? out), { status, headers: { "Content-Type": "application/json" } });
  });
}
