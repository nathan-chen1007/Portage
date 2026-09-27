import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { ProgramsPanel } from "../components/ProgramsPanel.jsx";
import { mockFetch } from "./fixtures.js";

const prog = (id, status, status_label, extra = {}) => ({
  id, name: id.toUpperCase(), what: `What ${id} does`, status, status_label, reason: `Reason for ${id}`, note: "",
  url: `https://example.gc.ca/${id}`, sources: [`https://example.gc.ca/${id}`], as_of: "2026-09-26", ...extra,
});
const RESPONSE = {
  country_code: "JP", country: "Japan", category: "honey", agri_food: true, as_of: "2026-09-26",
  label: "May qualify: confirm with the program", note: "Portage never guarantees eligibility.",
  programs: [
    prog("tcs", "may_qualify", "May qualify"),
    prog("canexport", "likely_not", "Likely not eligible", { note: "The 2026–27 intake closed on August 31, 2026." }),
    prog("agrimarketing", "may_qualify", "May qualify"),
    prog("edc", "may_qualify", "May qualify"),
  ],
};

test("lists each program with a status, reason, official link and as-of date", async () => {
  const f = mockFetch({ "/api/programs": RESPONSE });
  vi.stubGlobal("fetch", f);
  render(<ProgramsPanel countryCode="JP" category="honey" />);
  const panel = await screen.findByTestId("programs-panel");
  expect(within(panel).getByRole("heading", { name: "Help you may qualify for" })).toBeInTheDocument();
  expect(panel).toHaveTextContent("May qualify: confirm with the program");
  expect(screen.getByTestId("program-status-canexport")).toHaveTextContent("Likely not eligible");
  expect(screen.getByTestId("program-canexport")).toHaveTextContent("closed on August 31, 2026");
  expect(within(panel).getByRole("link", { name: "TCS" })).toHaveAttribute("href", "https://example.gc.ca/tcs");
  expect(panel).toHaveTextContent("as of 2026-09-26");
  const url = new URL(f.mock.calls[0][0], "http://localhost");
  expect(url.searchParams.get("country_code")).toBe("JP");
  expect(url.searchParams.get("category")).toBe("honey");
  expect(url.searchParams.get("revenue")).toBe("unknown");
});

test("the revenue and employee dropdowns re-ask the backend (Not sure by default)", async () => {
  const f = mockFetch({ "/api/programs": RESPONSE });
  vi.stubGlobal("fetch", f);
  render(<ProgramsPanel countryCode="DE" category="b2b_saas" />);
  await screen.findByTestId("programs-panel");
  const revenue = screen.getByRole("combobox", { name: /Annual revenue/ });
  expect(revenue).toHaveValue("unknown");
  await userEvent.selectOptions(revenue, "300k_plus");
  await userEvent.selectOptions(screen.getByRole("combobox", { name: /Full-time employees/ }), "3_plus");
  await vi.waitFor(() => {
    const last = new URL(f.mock.calls.at(-1)[0], "http://localhost").searchParams;
    expect(last.get("revenue")).toBe("300k_plus");
    expect(last.get("employees")).toBe("3_plus");
  });
});

test("renders nothing when the backend doesn't serve it", async () => {
  const f = mockFetch({});
  vi.stubGlobal("fetch", f);
  const { container } = render(<ProgramsPanel countryCode="JP" category="honey" />);
  await vi.waitFor(() => expect(f).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});
