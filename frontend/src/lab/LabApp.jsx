// EXPERIMENTAL lab page, only rendered at /?lab=1. Owned by session C (see project doc claude/afhacks-lab-C.md).
// Talks only to /api/explore/* (backend EXPERIMENTAL=1). Never imported by the demo app.
//
// Any product: describe it -> confirm the HS code -> every market ranked by the same engine as honey,
// with a compliance-confidence badge beside each score.
import { useEffect, useRef, useState } from "react";
import { Badge, Button, ErrorNote, ExternalLink, Segmented, Slider, Spinner } from "../components/ui.jsx";
import { VIEWS } from "../lib/format.js";
import { labApi, hsDotted } from "./labApi.js";
import { LabMarketRow } from "./LabMarketRow.jsx";

const POLL_MS = 6000;
const MAX_POLLS = 15;

const NICE = { "040900": "Honey", "170220": "Maple syrup", "151411": "Canola oil", "151419": "Canola oil (refined)", "030632": "Live lobster", "030612": "Frozen lobster" };

function shortName(p) {
  if (NICE[p.hs6]) return NICE[p.hs6];
  const d = p.description.includes(";") ? p.description.split(";").slice(1).join(";") : p.description;
  return d.split(/[,(]/)[0].trim().slice(0, 32) || p.hs6;
}

const SOURCE_LABEL = { llm: "AI suggestion", keyword: "Keyword match", user: "Chosen" };

export default function LabApp() {
  const [description, setDescription] = useState("");
  const [candidates, setCandidates] = useState(null);
  const [mode, setMode] = useState(null);
  const [chosen, setChosen] = useState(null); // {hs6, description, source}
  const [query, setQuery] = useState("");
  const [searchHits, setSearchHits] = useState(null);
  const [result, setResult] = useState(null);
  const [view, setView] = useState("overall");
  const [prize, setPrize] = useState(0.5);
  const [busy, setBusy] = useState(null); // "classify" | "rank" | "search"
  const [error, setError] = useState(null);
  const [cached, setCached] = useState([]);
  const polls = useRef(0);

  useEffect(() => {
    labApi.cached().then((list) => setCached(list.filter((p) => p.complete))).catch(() => {});
  }, []);

  async function classify(e) {
    e?.preventDefault();
    if (description.trim().length < 3) return;
    setBusy("classify");
    setError(null);
    setResult(null);
    try {
      const r = await labApi.classify(description.trim());
      setCandidates(r.candidates);
      setMode(r.mode);
      setChosen(r.candidates[0] ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function search(e) {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setBusy("search");
    try {
      setSearchHits(await labApi.search(query.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function rank(pick = chosen, opts = {}) {
    if (!pick) return;
    const sortBy = opts.view ?? view;
    const prizeWeight = opts.prize ?? prize;
    if (!opts.poll) {
      setBusy("rank");
      polls.current = 0;
    }
    setError(null);
    try {
      const r = await labApi.rank(pick.hs6, {
        description: description.trim() || undefined,
        classified_by: pick.source ?? "user",
        sort_by: sortBy,
        prize_weight: prizeWeight,
      });
      setResult(r);
    } catch (err) {
      setError(err.message);
    } finally {
      if (!opts.poll) setBusy(null);
    }
  }

  // Slow sources keep loading in the background on the server: ask again until everything is in.
  useEffect(() => {
    if (!result?.product.pending || polls.current >= MAX_POLLS) return undefined;
    const t = setTimeout(() => {
      polls.current += 1;
      rank(chosen, { poll: true });
    }, POLL_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  function pick(c) {
    setChosen(c);
    setResult(null);
  }

  function quick(p) {
    const c = { hs6: p.hs6, description: p.description, source: "user" };
    setCandidates(null);
    setChosen(c);
    rank(c);
  }

  const statusBy = Object.fromEntries((result?.data_status ?? []).map((s) => [s.country_code, s]));
  const unknownCount = (result?.data_status ?? []).filter((s) => s.compliance_confidence === "unknown").length;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="text-xs uppercase tracking-wide text-neutral-400">Portage lab · experimental</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Any product</h1>
      <p className="mt-2 text-sm text-neutral-500">
        Describe what you sell. We find its HS code, pull tariffs (WITS/UNCTAD TRAINS) and import data (UN Comtrade), and rank the
        same eight markets with the same engine as honey — with an honest badge for how well we know each market's paperwork.
      </p>

      {cached.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-neutral-400">Ready instantly:</span>
          {cached.map((p) => (
            <Button key={p.hs6} size="xs" variant="outline" onClick={() => quick(p)} title={p.description}>
              {shortName(p)} · {hsDotted(p.hs6)}
            </Button>
          ))}
        </div>
      )}

      <form onSubmit={classify} className="mt-5 space-y-2">
        <label htmlFor="lab-desc" className="text-sm font-medium">What do you sell?</label>
        <textarea
          id="lab-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="e.g. We make pure maple syrup in the Eastern Townships, sold in 250 ml glass bottles."
          className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm shadow-sm focus:border-neutral-400 focus:outline-none"
        />
        <Button type="submit" disabled={busy === "classify" || description.trim().length < 3}>
          {busy === "classify" && <Spinner />} Find the HS code
        </Button>
      </form>

      <div className="mt-4"><ErrorNote>{error}</ErrorNote></div>

      {candidates && (
        <section className="mt-6" aria-label="HS code candidates">
          <h2 className="text-sm font-semibold">Is this your product?</h2>
          <p className="text-xs text-neutral-500">
            {mode === "offline" ? "AI unavailable: keyword matches only. " : ""}Every code is checked against the official HS list. Pick one, or search below.
          </p>
          {candidates.length === 0 && <p className="mt-2 text-sm text-neutral-500">No goods code fits. Services have no HS code: try the main app.</p>}
          <ul className="mt-2 space-y-1.5">
            {candidates.map((c) => (
              <li key={c.hs6}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm ${chosen?.hs6 === c.hs6 ? "border-neutral-900" : "border-neutral-200"}`}>
                  <input type="radio" name="hs" checked={chosen?.hs6 === c.hs6} onChange={() => pick(c)} className="mt-1" />
                  <span className="flex-1">
                    <span className="font-mono text-xs font-semibold">{hsDotted(c.hs6)}</span> <span>{c.description}</span>
                    {c.reason && <span className="block text-xs text-neutral-500">{c.reason}</span>}
                  </span>
                  <Badge tone={c.source === "llm" ? "accent" : "outline"}>{SOURCE_LABEL[c.source]}</Badge>
                </label>
              </li>
            ))}
          </ul>
          <form onSubmit={search} className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Not right? Search the HS list (words or a code)"
              aria-label="Search HS codes"
              className="flex-1 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm"
            />
            <Button type="submit" size="sm" variant="outline" disabled={busy === "search"}>Search</Button>
          </form>
          {searchHits && (
            <ul className="mt-2 max-h-56 space-y-1 overflow-auto text-sm">
              {searchHits.length === 0 && <li className="text-neutral-500">No matches.</li>}
              {searchHits.map((h) => (
                <li key={h.hs6}>
                  <button type="button" onClick={() => { pick(h); setCandidates((cs) => (cs?.some((c) => c.hs6 === h.hs6) ? cs : [h, ...(cs ?? [])])); }}
                    className="w-full rounded-md px-2 py-1 text-left hover:bg-neutral-100">
                    <span className="font-mono text-xs font-semibold">{hsDotted(h.hs6)}</span> {h.description}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Button className="mt-4" onClick={() => rank()} disabled={!chosen || busy === "rank"}>
            {busy === "rank" && <Spinner />} Rank markets for {chosen ? hsDotted(chosen.hs6) : "…"}
          </Button>
        </section>
      )}

      {busy === "rank" && !result && (
        <p className="mt-6 flex items-center gap-2 text-sm text-neutral-500"><Spinner /> Fetching tariffs and trade data (up to ~10 s)…</p>
      )}

      {result && (
        <section className="mt-8" aria-label="Ranked markets">
          <div className="rounded-xl bg-neutral-50 p-4 text-sm">
            <p className="font-mono text-xs text-neutral-500">HS {hsDotted(result.product.hs6)} · {SOURCE_LABEL[result.product.classified_by]}</p>
            <p className="mt-1 font-medium">{result.product.description}</p>
            <p className="mt-1 text-xs text-neutral-500">
              Tariffs: <ExternalLink href="https://wits.worldbank.org/">WITS / UNCTAD TRAINS</ExternalLink> · Imports:{" "}
              <ExternalLink href="https://comtradeplus.un.org/">UN Comtrade</ExternalLink> {result.product.base_year}–{result.product.trade_year} ·
              Shipping and country risk: Portage curated data · as of {result.product.as_of}
            </p>
            {result.product.pending && (
              <p className="mt-2 flex items-center gap-2 text-xs text-neutral-600"><Spinner className="h-3 w-3" /> Some sources are still loading; updating automatically…</p>
            )}
            {unknownCount > 0 && (
              <p className="mt-2 rounded-md bg-amber-100 px-2 py-1.5 text-xs font-medium text-amber-900">
                {unknownCount} of {result.data_status.length} markets: compliance not verified — confirm with the Trade Commissioner Service.
                They're scored with an assumed typical burden, never as paperwork-free.
              </p>
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <Segmented
              label="Rank by"
              size="sm"
              options={VIEWS.map((v) => ({ key: v.key, label: v.label, title: v.help }))}
              value={view}
              onChange={(v) => { setView(v); rank(chosen, { view: v }); }}
            />
            {result.opportunity_available && view === "overall" && (
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                Quick wins
                <Slider value={prize} onChange={setPrize} label="Quick wins to biggest prize" className="w-28" />
                Biggest prize
                <Button size="xs" variant="ghost" onClick={() => rank(chosen, { prize })}>Apply</Button>
              </label>
            )}
          </div>

          <ul className="mt-3 space-y-1.5">
            {result.markets.map((m) => (
              <LabMarketRow key={m.country_code} market={m} status={statusBy[m.country_code]} view={view} />
            ))}
          </ul>

          {result.notes.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-neutral-500">
              {result.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </section>
      )}
    </main>
  );
}
