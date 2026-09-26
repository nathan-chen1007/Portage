// Portage API contract. Mirrors backend/app/models.py — change both together.
// Copy this file to frontend/lib/api.ts.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Component = "tariff" | "compliance" | "customs" | "tax";
export type MarketStatus = "open" | "blocked";

export type Requirement = { name: string; tier: 1 | 2 | 3; detail: string; source: string };

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

export type ScoredMarket = {
  country: string;
  country_code: string;
  status: MarketStatus; // "blocked": show last, greyed, with status_note instead of a score
  status_note: string;
  score: number | null; // 0-100, lower = easier; null when blocked
  rank: number;
  components: Partial<Record<Component, number>>; // 0-1 each; {} when blocked
  breakdown: Partial<Record<Component, number>>; // points, sums to score; {} when blocked
  top_blocker: Component | null;
  entry: MarketEntry;
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

export type Weights = { tariff: number; compliance: number; customs: number; tax: number };

export type AnalyzeResponse = {
  profile: BusinessProfile;
  category: Category | null; // null => unsupported product; show a friendly message
  markets: ScoredMarket[];
  mode: "llm" | "offline";
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
  rank: (category: string, weights?: Weights) => request<ScoredMarket[]>("/api/rank", { category, weights }),
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
