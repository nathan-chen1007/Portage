import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LabApp from "./LabApp.jsx";

function market(code, country, rank, { score = 30, conf = "unknown", tariff = 0 } = {}) {
  return {
    country, country_code: code, status: "open", status_note: score == null ? "Tariff unavailable: no rate on record." : "",
    score, opportunity: score == null ? null : 50, overall: score == null ? null : 60, rank,
    components: {}, factors: {}, breakdown: {}, top_blocker: null, opportunity_facts: null,
    entry: {
      country, country_code: code, compliance_confidence: conf, tariff_rate: tariff, mfn_rate: 0.1, tariff_note: "note",
      trade_agreement: null, compliance_requirements: [], shipping_route: "", sources: ["https://wits.worldbank.org/x"],
    },
  };
}

const RANK = {
  product: { hs6: "170220", description: "Sugars; maple sugar and maple syrup", classified_by: "llm", catalog: "comtrade",
    trade_year: 2024, base_year: 2019, fetched: { cache: 33 }, pending: false, as_of: "2026-09-26" },
  markets: [market("JP", "Japan", 1, { conf: "auto_sourced" }), market("GB", "United Kingdom", 2), market("KR", "South Korea", 3, { score: null })],
  data_status: [
    { country_code: "JP", scored: true, tariff: "ok", tariff_origin: "cache", tariff_year: 2022, section338: "", trade: "ok", compliance_confidence: "auto_sourced", message: "" },
    { country_code: "GB", scored: true, tariff: "ok", tariff_origin: "cache", tariff_year: 2021, section338: "", trade: "ok", compliance_confidence: "unknown", message: "" },
    { country_code: "KR", scored: false, tariff: "unavailable", tariff_origin: "error", tariff_year: null, section338: "", trade: "ok", compliance_confidence: "unknown", message: "" },
  ],
  opportunity_available: true,
  notes: [],
};

function mockFetch() {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
    const body = url.includes("/cached") ? [] : url.includes("/classify")
      ? { mode: "llm", catalog: "comtrade", candidates: [{ hs6: "170220", description: "Sugars; maple sugar and maple syrup", reason: "Maple syrup", source: "llm" }] }
      : RANK;
    return { ok: true, status: 200, json: async () => body };
  });
}

describe("LabApp", () => {
  it("classifies, lets the founder confirm, and ranks with confidence badges", async () => {
    const fetchSpy = mockFetch();
    render(<LabApp />);
    await userEvent.type(screen.getByLabelText("What do you sell?"), "pure maple syrup");
    await userEvent.click(screen.getByRole("button", { name: /find the hs code/i }));
    expect(await screen.findByText("1702.20")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /rank markets for 1702\.20/i }));

    const list = await screen.findByRole("region", { name: "Ranked markets" });
    expect(within(list).getByText("Japan")).toBeInTheDocument();
    expect(within(list).getByText("Tariff unavailable")).toBeInTheDocument();
    expect(within(list).getAllByTestId("confidence-unknown")).toHaveLength(2);
    expect(within(list).getByTestId("confidence-auto_sourced")).toBeInTheDocument();
    expect(within(list).getAllByText(/confirm with the Trade Commissioner Service/).length).toBeGreaterThanOrEqual(2);

    const rankCall = fetchSpy.mock.calls.find(([u]) => u.includes("/rank"));
    expect(JSON.parse(rankCall[1].body)).toMatchObject({ hs6: "170220", classified_by: "llm", sort_by: "overall" });
  });

  it("explains how to turn the lab on when the routes are missing", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => (
      url.includes("/cached") ? { ok: true, status: 200, json: async () => [] }
        : { ok: false, status: 404, json: async () => ({ detail: "Not Found" }) }));
    render(<LabApp />);
    await userEvent.type(screen.getByLabelText("What do you sell?"), "lobster");
    await userEvent.click(screen.getByRole("button", { name: /find the hs code/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("EXPERIMENTAL=1");
  });
});
