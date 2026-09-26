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
    expect(screen.getByText("Preview · sample producers")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Join this shipment" }));
    expect(await screen.findByText("You're in.")).toBeInTheDocument();
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
