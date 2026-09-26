import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MarketList } from "../components/MarketList.jsx";
import { FrictionBar } from "../components/FrictionBar.jsx";
import { MARKETS } from "./fixtures.js";

describe("FrictionBar", () => {
  it("draws one segment per non-zero component", () => {
    render(<FrictionBar market={MARKETS[1]} />);
    expect(screen.getByTestId("seg-tariff")).toBeInTheDocument();
    expect(screen.getByTestId("seg-compliance")).toBeInTheDocument();
    expect(screen.queryByTestId("seg-tax")).not.toBeInTheDocument();
  });

  it("draws nothing for a blocked market", () => {
    const { container } = render(<FrictionBar market={MARKETS[2]} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("MarketList", () => {
  it("lists open markets with scores and blocked markets with their reason", () => {
    render(<MarketList markets={MARKETS} kind="goods" selected={null} onSelect={() => {}} />);
    expect(screen.getByText("United Kingdom")).toBeInTheDocument();
    expect(screen.getByText("67")).toBeInTheDocument(); // US score rounded
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

  it("shows the overall score and heading in the recommended view", () => {
    const markets = [{ ...MARKETS[0], overall: 71.2, opportunity: 60.4 }];
    render(<MarketList markets={markets} kind="goods" selected={null} onSelect={() => {}} view="overall" />);
    expect(screen.getByText("Markets, best bet first")).toBeInTheDocument();
    expect(screen.getByText("71")).toBeInTheDocument();
    expect(screen.getByText(/opportunity 60/)).toBeInTheDocument();
  });
});
