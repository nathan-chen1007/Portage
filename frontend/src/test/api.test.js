import { api, ApiError } from "../lib/api.js";
import { mockFetch } from "./fixtures.js";

describe("api client", () => {
  it("posts JSON and returns the parsed body", async () => {
    const fetchMock = mockFetch({ "/api/rank": (body) => [{ echoed: body.category }] });
    vi.stubGlobal("fetch", fetchMock);
    const out = await api.rank("honey");
    expect(out).toEqual([{ echoed: "honey" }]);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ category: "honey" });
  });

  it("surfaces the backend's error detail", async () => {
    vi.stubGlobal("fetch", mockFetch({ "/api/rank": { __status: 422, __body: { detail: "Unsupported category 'x'" } } }));
    await expect(api.rank("x")).rejects.toThrow("Unsupported category 'x'");
  });

  it("explains a missing endpoint instead of a bare 404", async () => {
    vi.stubGlobal("fetch", mockFetch({}));
    await expect(api.voice("hi", "ja")).rejects.toThrow(/isn't available on the backend yet/);
  });

  it("reports an unreachable backend clearly", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    const err = await api.health().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.message).toMatch(/Can't reach the backend/);
  });
});
