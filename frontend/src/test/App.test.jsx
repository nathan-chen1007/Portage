import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../App.jsx";
import { HONEY, MARKETS, PROFILE, mockFetch } from "./fixtures.js";

function backend(extra = {}) {
  return mockFetch({
    "/health": { status: "ok", markets: 16, categories: ["honey", "b2b_saas"] },
    "/api/categories": [HONEY],
    "/api/analyze": { profile: PROFILE, category: HONEY, markets: MARKETS, mode: "llm" },
    "/api/rank": MARKETS,
    ...extra,
  });
}

describe("App", () => {
  it("shows a clear message when the backend is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(<App />);
    expect(await screen.findByText("Backend offline")).toBeInTheDocument();
  });

  it("analyzes a description and shows the ranked markets and the top market's detail", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    expect(await screen.findByText("Live data")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Honey producer, Alberta"));
    await userEvent.click(screen.getByRole("button", { name: "Find my markets" }));

    expect(await screen.findByText("Markets, easiest first")).toBeInTheDocument();
    expect(screen.getAllByText("Natural honey").length).toBeGreaterThan(0);
    // First open market is selected and its detail panel is shown.
    const detail = screen.getByRole("heading", { level: 2, name: /United Kingdom/ });
    expect(detail).toBeInTheDocument();
    expect(screen.getByText("CUKTCA origin declaration")).toBeInTheDocument();
  });

  it("browses a category without the LLM", async () => {
    const fetchMock = backend();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Natural honey" }));
    expect(await screen.findByText("Markets, easiest first")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => url.endsWith("/api/rank"))).toBe(true);
  });

  it("shows a blocked market's reason instead of tabs", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Natural honey" }));
    const [list] = await screen.findAllByRole("list");
    await userEvent.click(within(list).getByText("Mexico"));
    expect(await screen.findByText("Not currently accessible")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("explains when paperwork isn't available on the backend yet", async () => {
    vi.stubGlobal("fetch", backend());
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Natural honey" }));
    await userEvent.click(await screen.findByRole("tab", { name: "Paperwork" }));
    expect(await screen.findByText(/isn't available on the backend yet/)).toBeInTheDocument();
  });
});
