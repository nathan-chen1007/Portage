// Lab API client: /api/explore/lookup/* (backend EXPERIMENTAL=1). Shapes: backend/app/explore/lookup/schemas.py.
import { ApiError, API_URL } from "../lib/api.js";

async function call(path, body) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/explore/lookup${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach the backend. Is it running?", 0);
  }
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.detail) detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch {
      /* non-JSON body */
    }
    if (res.status === 404) detail = "Lab routes aren't mounted: set EXPERIMENTAL=1 in backend/.env and restart the backend.";
    throw new ApiError(detail, res.status);
  }
  return res.json();
}

export const labApi = {
  classify: (description) => call("/classify", { description }),
  search: (q) => call(`/search?q=${encodeURIComponent(q)}`),
  cached: () => call("/cached"),
  // opts: { description, classified_by, sort_by, prize_weight }
  rank: (hs6, opts = {}) => {
    const body = { hs6 };
    for (const k of ["description", "classified_by", "sort_by", "prize_weight"]) if (opts[k] != null) body[k] = opts[k];
    return call("/rank", body);
  },
};

export function hsDotted(code) {
  return code && code.length === 6 ? `${code.slice(0, 4)}.${code.slice(4)}` : code;
}
