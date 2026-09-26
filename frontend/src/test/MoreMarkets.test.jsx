import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { MoreMarkets, hs6For, sourceLabel } from "../components/MoreMarkets.jsx";
import { mockFetch } from "./fixtures.js";

const WITS = "https://wits.worldbank.org/API/V1/SDMX/V21/datasource/TRN/reporter/918/partner/124/product/040900/year/ALL/datatype/reported?format=JSON";
const COMTRADE = "https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=251&period=2024&cmdCode=040900&flowCode=M&partnerCode=0,124";

const FR = {
  country_code: "FR",
  country: "France",
  agreement_in_force: "CETA",
  tariff: { status: "ok", applied: 0, mfn: 0.173, year: 2021, agreement: "CETA", note: "Rate for Canada 0% (WITS/TRAINS 2021)", origin: "cache", fetched: "2026-09-26", sources: [WITS] },
  tariff_barrier: 0,
  opportunity: 61.4,
  opportunity_components: { demand: 0.7, price: 0.5, growth: 0.4, foothold: 0.1 },
  opportunity_facts: {
    year: 2024, import_value_usd: 120e6, import_volume_kg: 30e6, unit_value_usd_kg: 4, net_unit_value_usd_kg: 4,
    canada_unit_value_usd_kg: 6.1, growth_rate: 0.031, growth_years: "2019–2024", canada_share: 0.004, note: "", sources: [COMTRADE],
  },
  opportunity_status: "ok",
  opportunity_note: "",
  ease: null,
  overall: null,
  ease_note: "No ease score: compliance, shipping and country risk aren't verified for this market.",
  compliance_confidence: "unknown",
  verified: false,
  badge: "Not verified: confirm with the Trade Commissioner Service",
  sources: [WITS, COMTRADE],
};
const IN = {
  ...FR,
  country_code: "IN",
  country: "India",
  agreement_in_force: null,
  tariff: { status: "unavailable", applied: null, mfn: null, year: null, agreement: null, note: "Tariff unavailable: WITS/TRAINS has no rate on record.", origin: "error", fetched: "", sources: [] },
  opportunity: null,
  opportunity_facts: null,
  opportunity_status: "unavailable",
  opportunity_note: "Opportunity needs the tariff (price after duty); it isn't available for this market.",
  sources: ["https://www.tradecommissioner.gc.ca/"],
};
const RESPONSE = {
  hs6: "040900", description: "Natural honey", category: null, as_of: "2026-09-26", trade_year: 2024, base_year: 2019,
  pending: false, scale_note: "It is not a recommendation.", notes: [], markets: [FR, IN],
};

function backend(routes = { "/api/more-markets": RESPONSE }) {
  const f = mockFetch(routes);
  vi.stubGlobal("fetch", f);
  return f;
}

test("maps the product to an HS6 code", () => {
  expect(hs6For("0409.00")).toBe("040900");
  expect(hs6For(undefined, "icewine")).toBe("220421");
  expect(hs6For(undefined, "b2b_saas")).toBeNull();
  expect(sourceLabel(WITS)).toBe("WITS/TRAINS: tariff for Canada");
  expect(sourceLabel(COMTRADE)).toBe("UN Comtrade: imports 2024");
});

test("lists every market with tariff, agreement, opportunity and a red Not verified badge", async () => {
  const f = backend();
  render(<MoreMarkets hsCode="0409.00" />);
  const section = await screen.findByTestId("more-markets");
  expect(within(section).getByRole("heading", { name: "More markets: tariffs and trade data only" })).toBeInTheDocument();
  expect(f.mock.calls[0][0]).toContain("/api/more-markets?hs6=040900");
  await screen.findByText("France");
  expect(screen.getByText("Tariff 0% (2021)")).toBeInTheDocument();
  expect(screen.getByText("Agreement: CETA")).toBeInTheDocument();
  expect(screen.getByText("Opportunity 61/100")).toBeInTheDocument();
  expect(screen.getByText("Tariff unavailable")).toBeInTheDocument();
  expect(screen.getByText("No trade agreement with Canada")).toBeInTheDocument();
  const badges = screen.getAllByTestId("confidence-unknown");
  expect(badges).toHaveLength(2);
  badges.forEach((b) => expect(b).toHaveTextContent("Not verified: confirm with the Trade Commissioner Service"));
  // Never looks like the Recommended ranking: no rank numbers, no ease/overall score.
  expect(section).toHaveTextContent("Not part of the Recommended ranking");
  expect(section).not.toHaveTextContent(/#1|Rank|Overall|Ease \d/);
  // No paperwork, outreach or Ship together.
  expect(section).not.toHaveTextContent(/paperwork|outreach|Ship together/i);
});

test("clicking a row shows its numbers and sources only", async () => {
  backend();
  render(<MoreMarkets hsCode="040900" />);
  await userEvent.click(await screen.findByRole("button", { name: /France/ }));
  const d = screen.getByTestId("more-details-FR");
  expect(d).toHaveTextContent("Rate for Canada 0% (WITS/TRAINS 2021)");
  expect(d).toHaveTextContent("Without an agreement (MFN): 17.3%");
  expect(d).toHaveTextContent("$120.0M");
  expect(d).toHaveTextContent("$4/kg (Canada $6.1/kg)");
  expect(d).toHaveTextContent("No ease score");
  expect(within(d).getByRole("link", { name: "WITS/TRAINS: tariff for Canada" })).toHaveAttribute("href", WITS);
  expect(within(d).getByRole("link", { name: "UN Comtrade: imports 2024" })).toHaveAttribute("href", COMTRADE);
  expect(within(d).queryByRole("button")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: /India/ }));
  expect(screen.getByTestId("more-details-IN")).toHaveTextContent("Opportunity needs the tariff");
  expect(screen.queryByTestId("more-details-FR")).toBeNull();
});

test("renders nothing when the backend doesn't serve it, or for services", async () => {
  const f = backend({});
  const { container } = render(<MoreMarkets hsCode="0409.00" />);
  await vi.waitFor(() => expect(f).toHaveBeenCalled());
  await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
  const g = backend();
  const { container: c2 } = render(<MoreMarkets category="b2b_saas" />);
  expect(c2).toBeEmptyDOMElement();
  expect(g).not.toHaveBeenCalled();
});

test("France, Netherlands and Italy can carry Germany's verified EU rules, with a green badge and no score change", async () => {
  const FR_EU = {
    ...FR,
    compliance_confidence: "verified",
    verified: true,
    badge: "Verified",
    compliance_note: "EU rules, same as Germany",
    requirements: [
      { name: "CETA origin declaration", tier: 1, detail: "Origin declaration on the invoice.", source: "https://www.international.gc.ca/", lead_time_weeks: 0, lead_time_basis: "official", confidence: "verified" },
      { name: "French-language labelling", tier: 1, detail: "Mandatory label information must be at least in French.", source: "https://www.economie.gouv.fr/dgccrf/", lead_time_weeks: 2, lead_time_basis: "estimate", confidence: "verified" },
    ],
  };
  backend({ "/api/more-markets": { ...RESPONSE, markets: [FR_EU, IN] } });
  render(<MoreMarkets hsCode="040900" />);
  const section = await screen.findByTestId("more-markets");
  expect(await within(section).findByTestId("confidence-verified")).toHaveTextContent("Verified");
  expect(within(section).getAllByTestId("confidence-unknown")).toHaveLength(1); // India stays Not verified
  expect(section).toHaveTextContent("EU rules, same as Germany");
  expect(section).not.toHaveTextContent(/Overall|Ease \d/);
  await userEvent.click(screen.getByRole("button", { name: /France/ }));
  const d = screen.getByTestId("more-details-FR");
  expect(d).toHaveTextContent("French-language labelling");
  expect(within(d).getByRole("link", { name: /economie\.gouv\.fr|DGCCRF|economie/i })).toBeInTheDocument();
});
