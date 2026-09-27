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
  sea_distance_nm: 3047,
  weekly_sailings: 1.5,
  shipping_route: "Montreal → Liverpool, ~13 days",
  shipping_source: null,
  notes: [],
  sources: ["https://example.com/source"],
  as_of: "2026-09-26",
  ...over,
});

const facts = (code, currency) => ({
  country_code: code,
  currency,
  fx_volatility: 0.05,
  fx_note: "Annualized volatility vs CAD.",
  fx_source: "https://www.bankofcanada.ca/",
  country_risk: 0,
  country_risk_source: "https://www.oecd.org/",
  as_of: "2026-09-26",
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
    score: 15.7,
    opportunity: null,
    overall: null,
    rank: 1,
    components: { tariff: 0, compliance: 0.256, logistics: 0.402, risk: 0.203, tax: 0 },
    factors: { tiers: 0.375, lead_time: 0.077, distance: 0.305, sailings: 0.625, customs: 0.375, fx: 0.339, country_risk: 0 },
    breakdown: { tariff: 0, compliance: 7.67, logistics: 6.04, risk: 2.03, tax: 0 },
    top_blocker: "compliance",
    opportunity_components: {},
    opportunity_facts: null,
    lead_time_weeks: 2,
    lead_time_estimated: true,
    country_facts: facts("GB", "GBP"),
    entry: entry({
      country: "United Kingdom",
      country_code: "GB",
      mfn_rate: 0.16,
      trade_agreement: "Canada-UK Trade Continuity Agreement (CUKTCA)",
      compliance_requirements: [
        {
          name: "CUKTCA origin declaration",
          tier: 1,
          detail: "Self-declared on the invoice.",
          source: "https://example.com/d11",
          lead_time_weeks: 0,
          lead_time_basis: "official",
        },
      ],
    }),
    middlemen: [
      {
        id: "tcs",
        category: "*",
        country_code: "*",
        name: "Canadian Trade Commissioner Service",
        type: "government",
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
    opportunity: null,
    overall: null,
    rank: 2,
    components: { tariff: 1, compliance: 0.625, logistics: 0.2, risk: 0, tax: 0 },
    factors: {},
    breakdown: { tariff: 35, compliance: 18.75, logistics: 3, risk: 0, tax: 0 },
    top_blocker: "tariff",
    opportunity_components: {},
    opportunity_facts: null,
    lead_time_weeks: 4,
    lead_time_estimated: true,
    country_facts: facts("US", "USD"),
    entry: entry({ country: "United States", country_code: "US", tariff_rate: 0.5, trade_agreement: "CUSMA (does not exempt Section 338 tariffs)" }),
    middlemen: [],
  },
  {
    country: "Mexico",
    country_code: "MX",
    status: "blocked",
    status_note: "Canada does not meet Mexico's requirements for exporting honey. No certificate is currently available.",
    score: null,
    opportunity: null,
    overall: null,
    rank: 3,
    components: {},
    factors: {},
    breakdown: {},
    top_blocker: null,
    opportunity_components: {},
    opportunity_facts: null,
    lead_time_weeks: 0,
    lead_time_estimated: false,
    country_facts: null,
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
    const path = new URL(url, "http://localhost").pathname;
    const handler = routes[path];
    if (!handler) return new Response(JSON.stringify({ detail: "Not Found" }), { status: 404 });
    const body = init?.body ? JSON.parse(init.body) : undefined;
    const out = typeof handler === "function" ? handler(body) : handler;
    const status = out?.__status ?? 200;
    return new Response(JSON.stringify(out?.__body ?? out), { status, headers: { "Content-Type": "application/json" } });
  });
}
