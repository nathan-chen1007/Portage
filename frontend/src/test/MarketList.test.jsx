import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketList } from "../components/MarketList.jsx";
import { FrictionBar } from "../components/FrictionBar.jsx";
import { MARKETS } from "./fixtures.js";

describe("FrictionBar", () => {
  it("draws one segment per factor that earns ease points", () => {
    render(<FrictionBar market={MARKETS[1]} />);
    expect(screen.getByTestId("seg-compliance")).toBeInTheDocument();
    expect(screen.getByTestId("seg-tax")).toBeInTheDocument(); // no tax barrier: full 10 points
    expect(screen.queryByTestId("seg-tariff")).not.toBeInTheDocument(); // 50% tariff earns nothing
  });

  it("sizes each segment by the points it earns out of 100", () => {
    render(<FrictionBar market={MARKETS[1]} />);
    // compliance weight 30, costs 18.75 -> earns 11.25
    expect(parseFloat(screen.getByTestId("seg-compliance").style.width)).toBeCloseTo(11.25);
  });

  it("draws nothing for a blocked market", () => {
    const { container } = render(<FrictionBar market={MARKETS[2]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("opens a factor when a segment is clicked", async () => {
    const onSegment = vi.fn();
    render(<FrictionBar market={MARKETS[1]} onSegment={onSegment} />);
    await userEvent.click(screen.getByTestId("seg-compliance"));
    expect(onSegment).toHaveBeenCalledWith("compliance");
  });
});

describe("MarketList", () => {
  it("lists open markets with scores and blocked markets with their reason", () => {
    render(<MarketList markets={MARKETS} kind="goods" selected={null} onSelect={() => {}} />);
    expect(screen.getByText("United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("33")).toBeInTheDocument(); // US ease = 100 - 66.8 friction, rounded
    expect(screen.getByText("50% tariff")).toBeInTheDocument();
    expect(screen.getByText("Not accessible")).toBeInTheDocument();
    expect(screen.getByText(/does not meet Mexico's requirements/)).toBeInTheDocument();
  });

  it("calls onSelect with the country code", async () => {
    const onSelect = vi.fn();
    render(<MarketList markets={MARKETS} kind="goods" selected={null} onSelect={onSelect} />);
    await userEvent.click(screen.getByText("United States"));
    expect(onSelect).toHaveBeenCalledWith("US");
  });

  it("shows the overall score in the recommended view", () => {
    const markets = [{ ...MARKETS[0], overall: 71.2, opportunity: 60.4 }];
    render(<MarketList markets={markets} kind="goods" selected={null} onSelect={() => {}} view="overall" />);
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText("Prize")).toBeInTheDocument();
    expect(screen.getByText("Ease")).toBeInTheDocument();
  });

  it("shows the prize and its parts in the biggest-prize view", () => {
    const markets = [
      { ...MARKETS[0], overall: 71.2, opportunity: 60.4, opportunity_components: { demand: 1, price: 0.5, growth: 0.2, foothold: 0 } },
    ];
    render(<MarketList markets={markets} kind="goods" selected={null} onSelect={() => {}} view="opportunity" />);
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByTestId("prize-demand").style.width).toBe("35%");
    expect(screen.queryByTestId("prize-foothold")).not.toBeInTheDocument();
  });
});

describe("MarketList confidence badges", () => {
  it("badges every market: verified green, auto-sourced amber, unknown red", () => {
    const markets = MARKETS.map((m, i) => ({ ...m, entry: { ...m.entry, compliance_confidence: ["verified", "auto_sourced", "unknown"][i] ?? "verified" } }));
    render(<MarketList markets={markets} kind="goods" selected={null} onSelect={() => {}} />);
    expect(screen.getAllByTestId(/^confidence-/).length).toBe(markets.length);
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText("Auto-sourced: confirm with CFIA or the Trade Commissioner Service")).toBeInTheDocument();
    expect(screen.getByText("Not verified: confirm with the Trade Commissioner Service")).toBeInTheDocument();
  });
});
