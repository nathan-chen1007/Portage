// Portage API contract. Mirrors backend/app/models.py — change both together.
// Copy this file to frontend/lib/api.ts.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Component = "tariff" | "compliance" | "logistics" | "risk" | "tax";
// Sub-scores (0-1) behind the components: compliance = tiers + lead_time; logistics = distance + sailings + customs; risk = fx + country_risk.
export type Factor = "tiers" | "lead_time" | "distance" | "sailings" | "customs" | "fx" | "country_risk";
export type MarketStatus = "open" | "blocked";

export type Requirement = {
  name: string;
  tier: 1 | 2 | 3;
  detail: string;
  source: string;
  lead_time_weeks: number; // weeks this step adds before the first shipment
  lead_time_basis: "official" | "estimate"; // show "estimate" honestly in the UI
};

export type MarketEntry = {
  category: string;
  country: string;
  country_code: string;
  language: string;
  status: MarketStatus;
  status_note: string;
  tariff_rate: number; // fraction: 0.5 = 50%
  mfn_rate: number;
  tariff_note: string;
  trade_agreement: string | null;
  compliance_requirements: Requirement[];
  lpi_customs_score: number | null;
  tax_burden: number;
  tax_note: string;
  sea_distance_nm: number | null; // null for services; 0 = land border
  weekly_sailings: number | null;
  shipping_route: string; // e.g. "Vancouver → Yokohama, ~11 days, direct sailings 1-2×/week"
  shipping_source: string | null;
  notes: string[];
  sources: string[];
  as_of: string;
};

export type Middleman = {
  id: string;
  category: string;
  country_code: string;
  name: string;
  type: string;
  description: string;
  website: string;
  contact: string;
  source: string;
};

export type CountryFacts = {
  country_code: string;
  currency: string;
  fx_volatility: number; // fraction, 0.06 = 6% a year vs CAD
  fx_note: string;
  fx_source: string;
  country_risk: number; // OECD 0-7
  country_risk_source: string;
  as_of: string;
};

export type OpportunityFacts = {
  year: number;
  import_value_usd: number;
  import_volume_kg: number;
  unit_value_usd_kg: number; // what the market pays per kg
  net_unit_value_usd_kg: number; // ...after the tariff a Canadian exporter pays
  canada_unit_value_usd_kg: number; // Canada's own export price
  growth_rate: number; // CAGR, 0.05 = 5%/yr
  growth_years: string; // "2019–2024"
  canada_share: number; // 0.12 = 12% of the market's imports already come from Canada
  note: string;
  sources: string[];
};

export type SortBy = "overall" | "friction" | "opportunity";

export type ScoredMarket = {
  country: string;
  country_code: string;
  status: MarketStatus; // "blocked": show last, greyed, with status_note instead of a score
  status_note: string;
  score: number | null; // FRICTION 0-100, lower = easier; null when blocked
  opportunity: number | null; // 0-100, higher = more worth it; null when blocked or no trade data (SaaS)
  overall: number | null; // 0-100, higher = go here first; = 100 - friction when opportunity is null; null when blocked
  rank: number; // position under the requested sort_by (default "overall")
  components: Partial<Record<Component, number>>; // 0-1 each; {} when blocked
  factors: Partial<Record<Factor, number>>; // 0-1 each; {} when blocked
  breakdown: Partial<Record<Component, number>>; // points, sums to score; {} when blocked
  top_blocker: Component | null;
  opportunity_components: Partial<Record<"demand" | "price" | "growth" | "foothold", number>>; // 0-1 each
  opportunity_facts: OpportunityFacts | null;
  lead_time_weeks: number; // weeks before the first legal shipment
  lead_time_estimated: boolean;
  entry: MarketEntry;
  country_facts: CountryFacts | null;
  middlemen: Middleman[];
};

export type Category = {
  id: string;
  label: string;
  kind: "goods" | "services";
  hs_code: string | null;
  description: string;
  examples: string[];
};

export type BusinessProfile = {
  company_name: string;
  product_name: string;
  product_summary: string;
  category: string;
  category_reason: string;
  city: string;
  province: string;
  selling_points: string[];
  contact_name: string;
  contact_email: string;
  website: string;
  business_number: string;
};

export type Weights = { tariff: number; compliance: number; logistics: number; risk: number; tax: number };
export const DEFAULT_WEIGHTS: Weights = { tariff: 0.35, compliance: 0.3, logistics: 0.15, risk: 0.1, tax: 0.1 };

export type AnalyzeResponse = {
  profile: BusinessProfile;
  category: Category | null; // null => unsupported product; show a friendly message
  markets: ScoredMarket[];
  mode: "llm" | "offline";
  opportunity_available: boolean; // false for SaaS: show "opportunity not available for services"
};

export type DocumentDraft = {
  id: string; // "origin" | "dpa" | "checklist"
  title: string;
  purpose: string;
  body: string;
  missing_fields: string[];
  source: string;
};

export type OutreachDraft = { subject: string; body: string; language: string };
export type VoiceResponse = { script: string; language: string; audio_base64: string };

async function request<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res.json() as Promise<T>;
}

export const api = {
  categories: () => request<Category[]>("/api/categories"),
  analyze: (description: string) => request<AnalyzeResponse>("/api/analyze", { description }),
  // sort_by: which of the three views to rank by; prize_weight: 0 = quick wins (ease only) … 1 = biggest prize (opportunity only).
  rank: (category: string, opts: { weights?: Weights; sort_by?: SortBy; prize_weight?: number } = {}) =>
    request<ScoredMarket[]>("/api/rank", { category, ...opts }),
  documents: (profile: BusinessProfile, country_code: string) =>
    request<DocumentDraft[]>("/api/documents", { profile, country_code }),
  outreach: (profile: BusinessProfile, country_code: string, middleman_id: string) =>
    request<OutreachDraft>("/api/outreach", { profile, country_code, middleman_id }),
  voice: (text: string, language: string) => request<VoiceResponse>("/api/voice", { text, language }),
  async pdf(profile: BusinessProfile, country_code: string, docId: string) {
    const res = await fetch(`${API_URL}/api/documents/${docId}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, country_code }),
    });
    if (!res.ok) throw new Error(`PDF failed (${res.status})`);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docId}-${country_code}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
