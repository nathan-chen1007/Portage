import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";
import { HONEY, MARKETS, PROFILE, mockFetch } from "./fixtures.js";

function backend(extra = {}) {
  return mockFetch({
    "/health": { status: "ok", markets: 16, categories: ["honey", "b2b_saas"] },
    "/api/categories": [HONEY],
    "/api/analyze": { profile: PROFILE, category: HONEY, markets: MARKETS, mode: "llm", opportunity_available: false },
    "/api/rank": MARKETS,
    "/api/forwarders": {
      as_of: "2026-09-26",
      note: "",
      source: "https://www.ciffa.com/",
      route: "Vancouver → United Kingdom",
      confirm_note: "Confirm the route (Vancouver → United Kingdom) and food handling when you request a quote.",
      forwarders: [
        { id: "yusen-canada", name: "Yusen Logistics (Canada) Inc.", why: "CIFFA member", lcl_url: "https://example.com/lcl", contact_url: "https://example.com/quote" },
      ],
    },
    "/api/group-quote": { subject: "Group quote request", body: "natural honey, HS 0409.00", sample: true },
    ...extra,
  });
}

async function openHoney() {
  await userEvent.click(await screen.findByRole("button", { name: "Natural honey" }));
  await screen.findByText("Easiest first");
}

describe("App", () => {
  it("shows a clear message when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(<App />);
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
  });

  it("analyzes a description and opens the top market's panel", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    expect(await screen.findByText("Live data")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Honey producer, Alberta"));
    await userEvent.click(screen.getByRole("button", { name: "Find my markets" }));

    expect(await screen.findByText("Easiest first")).toBeInTheDocument();
    expect(screen.getAllByText("Natural honey").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: /United Kingdom/ })).toBeInTheDocument();
  });

  it("plays the loading sequence, then reveals the results", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Natural honey" }));
    expect(screen.getByText("Finding your markets")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    expect(await screen.findByText("Easiest first")).toBeInTheDocument();
    await vi.waitFor(() => expect(screen.queryByText("Finding your markets")).not.toBeInTheDocument());
  });

  it("browses a category without the LLM", async () => {
    const fetchMock = backend();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await openHoney();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/rank"))).toBe(true);
  });

  it("expands a factor tile in place to show the market's detail", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await openHoney();
    expect(screen.queryByText("CUKTCA origin declaration")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Compliance/, expanded: false }));
    expect(await screen.findByText("CUKTCA origin declaration")).toBeInTheDocument();
  });

  it("opens a factor panel that compares every market", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await openHoney();
    const chips = screen.getByRole("group", { name: "Explore a factor" });
    await userEvent.click(within(chips).getByRole("button", { name: "Tariffs" }));
    expect(await screen.findByText("How it's measured")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Back to market/ }));
    expect(screen.getByRole("heading", { level: 2, name: /United Kingdom/ })).toBeInTheDocument();
  });

  it("re-ranks with preset weights from the Tune panel", async () => {
    const fetchMock = backend();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await openHoney();
    await userEvent.click(screen.getByRole("button", { name: /Tune/ }));
    await userEvent.click(screen.getByRole("button", { name: "Lowest cost" }));
    await vi.waitFor(() => {
      const bodies = fetchMock.mock.calls.filter(([u]) => u.endsWith("/api/rank")).map(([, i]) => JSON.parse(i.body));
      expect(bodies.some((b) => b.weights?.tariff === 0.5)).toBe(true);
    });
  });

  it("lets you join a pooled shipment in the Ship together preview", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await openHoney();
    await userEvent.click(screen.getByRole("tab", { name: "Ship together" }));
    expect(screen.getByRole("heading", { name: /Canada is stronger together/ })).toBeInTheDocument();
    expect(screen.getAllByText("Preview: sample group").length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Join the group" }));
    expect(await screen.findByText("You're in the group.")).toBeInTheDocument();
    // Joining reveals one drafted group quote request and real forwarders: sample data, never sent.
    expect(screen.getByRole("heading", { name: "Request freight quotes for the group" })).toBeInTheDocument();
    expect(screen.getByText("Draft: nothing is sent")).toBeInTheDocument();
    expect(await screen.findByText("Yusen Logistics (Canada) Inc.")).toBeInTheDocument();
    expect(screen.getByText(/HS 0409.00/)).toBeInTheDocument();
    expect(screen.getByText(/Confirm the route/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /send/i })).not.toBeInTheDocument();
  });

  it("shows a blocked market's reason instead of tabs", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await openHoney();
    const list = screen.getByRole("list", { name: "Ranked markets" });
    await userEvent.click(within(list).getByText("Mexico"));
    expect(await screen.findByText("Not currently accessible")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("explains when paperwork isn't available on the backend yet", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await openHoney();
    await userEvent.click(screen.getByRole("tab", { name: "Paperwork" }));
    expect(await screen.findByText(/isn't available on the backend yet/)).toBeInTheDocument();
  });
});

describe("Any-product mode (products that aren't honey or B2B software)", () => {
  const lookupMarkets = MARKETS.map((m, i) => ({
    ...m,
    entry: {
      ...m.entry,
      category: "hs950699",
      compliance_confidence: ["auto_sourced", "unknown", "unknown"][i] ?? "unknown",
      compliance_requirements: (m.entry.compliance_requirements ?? []).map((r) => ({ ...r, confidence: i === 0 ? "auto_sourced" : "unknown" })),
    },
  }));
  const product = (hs6, description) => ({
    hs6, description, founder_description: "I make hockey sticks", classified_by: "keyword", catalog: "comtrade",
    trade_year: 2024, base_year: 2019, tariff_source: "WITS / UNCTAD TRAINS", trade_source: "UN Comtrade", fetched: {}, pending: false, as_of: "2026-09-26",
  });
  const analyzeResponse = {
    profile: { ...PROFILE, category: "hs950699" },
    category: { id: "hs950699", label: "Equipment for outdoor games", kind: "goods", hs_code: "9506.99", description: "Equipment for outdoor games", examples: [] },
    markets: lookupMarkets,
    mode: "offline",
    opportunity_available: false,
    lookup: {
      product: product("950699", "Equipment for outdoor games and recreation n.e.c. in heading no. 9506"),
      candidates: [
        { hs6: "950699", description: "Equipment for outdoor games and recreation n.e.c. in heading no. 9506", reason: "", source: "keyword" },
        { hs6: "950670", description: "Skates; ice and roller", reason: "", source: "keyword" },
      ],
      classify_mode: "offline",
      data_status: [],
      notes: [],
    },
  };

  it("shows the HS code to confirm or switch, and a confidence badge on every market", async () => {
    const fetchMock = backend({
      "/api/analyze": analyzeResponse,
      "/api/explore/lookup/rank": (body) => ({
        product: product(body.hs6, "Skates; ice and roller"), markets: lookupMarkets, data_status: [], opportunity_available: false, notes: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await userEvent.click(await screen.findByText("Honey producer, Alberta"));
    await userEvent.click(screen.getByRole("button", { name: "Find my markets" }));

    const select = await screen.findByRole("combobox", { name: "HS code" });
    expect(select).toHaveValue("950699");
    const list = screen.getByRole("list", { name: "Ranked markets" });
    expect(within(list).getAllByText("Auto-sourced: confirm with CFIA or the Trade Commissioner Service").length).toBe(1);
    expect(within(list).getAllByText("Not verified: confirm with the Trade Commissioner Service").length).toBe(2);
    // Paperwork / outreach / Ship together need verified data: not offered for any-product results.
    expect(screen.queryByRole("tab", { name: "Paperwork" })).not.toBeInTheDocument();

    await userEvent.selectOptions(select, "950670");
    await vi.waitFor(() => {
      const bodies = fetchMock.mock.calls.filter(([u]) => u.endsWith("/api/explore/lookup/rank")).map(([, i]) => JSON.parse(i.body));
      expect(bodies.some((b) => b.hs6 === "950670" && b.classified_by === "user")).toBe(true);
    });
  });
});
