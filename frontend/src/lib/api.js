// Portage API client. Shapes mirror backend/app/models.py (typed copy: docs/contract/api.ts).

// Empty = same origin: the Vite dev server proxies /api and /health to the backend (see vite.config.js).
// Set VITE_API_URL only to call a backend directly (it must allow this origin via CORS).
export const API_URL = (import.meta.env?.VITE_API_URL || "").replace(/\/$/, "");
const BACKEND_LABEL = API_URL || "the backend";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(`Can't reach ${BACKEND_LABEL}. Is it running?`, 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      // Non-JSON error body: the dev proxy answers like this when the backend is down.
      if (res.status >= 500) throw new ApiError(`Can't reach ${BACKEND_LABEL}. Is it running?`, res.status);
    }
    if (res.status === 404 && detail === "Not Found") detail = "This feature isn't available on the backend yet.";
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export const api = {
  health: () => request("/health"),
  categories: () => request("/api/categories"),
  analyze: (description) => request("/api/analyze", { description }),
  rank: (category, weights) => request("/api/rank", weights ? { category, weights } : { category }),
  documents: (profile, country_code) => request("/api/documents", { profile, country_code }),
  outreach: (profile, country_code, middleman_id) => request("/api/outreach", { profile, country_code, middleman_id }),
  voice: (text, language) => request("/api/voice", { text, language }),
  async pdf(profile, country_code, docId) {
    const res = await fetch(`${API_URL}/api/documents/${docId}/pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile, country_code }),
    });
    if (!res.ok) throw new ApiError(`PDF failed (${res.status})`, res.status);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement("a");
    a.href = url;
    a.download = `${docId}-${country_code}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  },
};

export function emptyProfile(category = "") {
  return {
    company_name: "",
    product_name: "",
    product_summary: "",
    category,
    category_reason: "",
    city: "",
    province: "",
    selling_points: [],
    contact_name: "",
    contact_email: "",
    website: "",
    business_number: "",
  };
}

export const DEFAULT_WEIGHTS = { tariff: 0.4, compliance: 0.35, customs: 0.15, tax: 0.1 };
