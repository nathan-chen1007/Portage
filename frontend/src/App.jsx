import { useEffect, useRef, useState } from "react";
import { DEFAULT_PRIZE_WEIGHT, DEFAULT_WEIGHTS, api, emptyProfile } from "./lib/api.js";
import { FactorChips } from "./components/FrictionBar.jsx";
import { FactorPanel } from "./components/FactorPanel.jsx";
import { LoadingScreen } from "./components/LoadingScreen.jsx";
import { MarketList } from "./components/MarketList.jsx";
import { MarketPanel } from "./components/MarketPanel.jsx";
import { MoreMarkets } from "./components/MoreMarkets.jsx";
import { OpportunityMap } from "./components/OpportunityMap.jsx";
import { TunePanel } from "./components/TunePanel.jsx";
import { HealthPill, Logo } from "./components/Brand.jsx";
import { Landing } from "./components/Landing.jsx";
import { Badge, Button, Icon, Segmented, Spinner } from "./components/ui.jsx";
import { COMPONENTS, VIEWS } from "./lib/format.js";

export { EXAMPLES } from "./components/Landing.jsx";

const HEADINGS = { overall: "Best bet first", friction: "Easiest first", opportunity: "Biggest opportunity first" };

export default function App() {
  const [health, setHealth] = useState("checking"); // checking | ok | down
  const [categories, setCategories] = useState([]);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null); // { profile, category, markets, mode, opportunity_available }
  const [selected, setSelected] = useState(null);
  const [panel, setPanel] = useState("market"); // "market" or a component key (factor panel)
  const [openFactor, setOpenFactor] = useState(null); // factor tile expanded inside the market panel
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [view, setView] = useState("overall"); // overall | friction | opportunity
  const [layout, setLayout] = useState("list"); // list | map
  const [prize, setPrize] = useState(DEFAULT_PRIZE_WEIGHT);
  const [loader, setLoader] = useState(null); // { subject, ready } while the loading sequence runs
  const [revealKey, setRevealKey] = useState(0);
  const pending = useRef(null);
  const loading = loader !== null;
  const [reranking, setReranking] = useState(false);
  const [error, setError] = useState(null);
  const rerankTimer = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => {
    api
      .health()
      .then(() => {
        setHealth("ok");
        return api.categories().then(setCategories);
      })
      .catch(() => setHealth("down"));
  }, []);

  function showResult(r) {
    const available = r.opportunity_available ?? r.markets.some((m) => m.opportunity != null);
    setResult({ ...r, opportunity_available: available });
    setWeights(DEFAULT_WEIGHTS);
    setView(available ? "overall" : "friction");
    setLayout("list");
    setPrize(DEFAULT_PRIZE_WEIGHT);
    setPanel("market");
    setOpenFactor(null);
    const firstOpen = r.markets.find((m) => m.status !== "blocked" && m.score != null) ?? r.markets[0];
    setSelected(firstOpen?.country_code ?? null);
  }

  // Run a backend call behind the animated loading sequence; the result is revealed when the sequence ends.
  async function runWithLoader(subject, fetchResult) {
    setError(null);
    pending.current = null;
    setLoader({ subject, ready: false });
    try {
      pending.current = await fetchResult();
      setLoader((l) => (l ? { ...l, ready: true } : l));
    } catch (e) {
      setLoader(null);
      setError(e.message);
    }
  }

  function finishLoading() {
    if (pending.current) showResult(pending.current);
    pending.current = null;
    setLoader(null);
    setRevealKey((k) => k + 1);
  }

  function analyze(text = description) {
    const t = text.trim();
    if (t.length < 10) return;
    runWithLoader(t, () => api.analyze(t));
  }

  function pickCategory(cat) {
    runWithLoader(cat.label, async () => {
      const markets = await api.rank(cat.id);
      return { profile: emptyProfile(cat.id), category: cat, markets, mode: "direct" };
    });
  }

  function reset() {
    setResult(null);
    setSelected(null);
    setError(null);
  }

  // Any-product result (not honey / B2B SaaS): ranked by the HS-code lookup instead of the curated catalog.
  function applyLookup(resp) {
    setResult((r) => ({
      ...r,
      markets: resp.markets,
      opportunity_available: resp.opportunity_available,
      category: { ...r.category, id: `hs${resp.product.hs6}`, label: resp.product.description.slice(0, 120), hs_code: `${resp.product.hs6.slice(0, 4)}.${resp.product.hs6.slice(4)}` },
      profile: { ...r.profile, category: `hs${resp.product.hs6}` },
      lookup: { ...r.lookup, product: resp.product, data_status: resp.data_status, notes: resp.notes },
    }));
  }

  // The founder confirms or switches the HS code we suggested: re-rank every market for the new code.
  async function switchHs(hs6) {
    if (!result?.lookup || hs6 === result.lookup.product.hs6) return;
    setReranking(true);
    setError(null);
    // A code we have verified data for (honey 0409.00, icewine 2204.21) goes to the verified path, with
    // Paperwork, Partners & outreach and Ship together, instead of the any-product ranking.
    const curated = categories.find((c) => c.kind === "goods" && c.hs_code && c.hs_code.replace(".", "") === hs6);
    if (curated) {
      try {
        const markets = await api.rank(curated.id);
        showResult({ profile: { ...result.profile, category: curated.id }, category: curated, markets, mode: result.mode });
      } catch (e) {
        setError(e.message);
      } finally {
        setReranking(false);
      }
      return;
    }
    try {
      const resp = await api.lookupRank(hs6, {
        description: result.lookup.product.founder_description,
        weights,
        sort_by: result.opportunity_available ? view : "friction",
        prize_weight: prize,
      });
      applyLookup(resp);
      if (!resp.opportunity_available) setView("friction");
      const firstOpen = resp.markets.find((m) => m.status !== "blocked" && m.score != null) ?? resp.markets[0];
      setSelected(firstOpen?.country_code ?? null);
      setPanel("market");
    } catch (e) {
      setError(e.message);
    } finally {
      setReranking(false);
    }
  }

  // Re-rank on the backend with the current controls (any argument overrides the current state).
  function rerank({ weights: w = weights, view: v = view, prize: p = prize } = {}) {
    if (!result?.category) return;
    clearTimeout(rerankTimer.current);
    rerankTimer.current = setTimeout(async () => {
      if (Object.values(w).every((x) => x === 0)) return;
      setReranking(true);
      try {
        if (result.lookup) {
          const resp = await api.lookupRank(result.lookup.product.hs6, {
            description: result.lookup.product.founder_description,
            classified_by: result.lookup.product.classified_by,
            weights: w,
            sort_by: v,
            prize_weight: p,
          });
          applyLookup(resp);
          return;
        }
        const markets = await api.rank(result.category.id, { weights: w, sort_by: v, prize_weight: p });
        setResult((r) => ({ ...r, markets }));
      } catch (e) {
        setError(e.message);
      } finally {
        setReranking(false);
      }
    }, 200);
  }

  const changeWeights = (w) => {
    setWeights(w);
    rerank({ weights: w });
  };
  const changeView = (v) => {
    setView(v);
    rerank({ view: v });
  };
  const changePrize = (p) => {
    setPrize(p);
    rerank({ prize: p });
  };

  function focusPanel() {
    panelRef.current?.scrollTo?.({ top: 0, behavior: "smooth" });
  }

  function selectMarket(code, factor = null) {
    setSelected(code);
    setPanel("market");
    setOpenFactor(factor);
    focusPanel();
  }

  function openFactorPanel(key) {
    setPanel(key ?? "market");
    focusPanel();
  }

  const overlay = loader && <LoadingScreen subject={loader.subject} ready={loader.ready} onFinished={finishLoading} />;

  if (!result?.category) {
    return (
      <>
        <Landing
        health={health}
        categories={categories}
        description={description}
        setDescription={setDescription}
        onAnalyze={() => analyze()}
        onPickCategory={pickCategory}
        loading={loading}
        error={error}
        unsupported={result && !result.category}
        />
        {overlay}
      </>
    );
  }

  const market = result.markets.find((m) => m.country_code === selected);
  const activeView = result.opportunity_available ? view : "friction";
  const factorOpen = panel !== "market" && COMPONENTS.some((c) => c.key === panel);

  return (
    <div key={revealKey} className="reveal app-bg flex min-h-screen flex-col text-neutral-900 lg:h-screen lg:overflow-hidden">
      {overlay}
      <TopBar
        health={health}
        result={result}
        description={description}
        setDescription={setDescription}
        onAnalyze={() => analyze()}
        onReset={reset}
        loading={loading}
      />

      {result.lookup && <HsStrip lookup={result.lookup} onSwitch={switchHs} busy={reranking} />}

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[27rem_1fr]">
        {/* ---------- left: controls + ranked list ---------- */}
        <aside className="reveal-left glass flex min-h-0 flex-col border-neutral-900/[0.06] lg:border-r">
          <div className="border-b border-neutral-100 p-3">
            {result.opportunity_available ? (
              <Segmented
                stretch
                size="sm"
                label="Rank markets by"
                value={view}
                onChange={changeView}
                options={VIEWS.map((v) => ({ key: v.key, label: v.label, title: v.help }))}
              />
            ) : (
              <p className="px-1 text-xs text-neutral-500">Ranked by ease of entry.</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
            <h2 className="text-sm font-semibold">
              {HEADINGS[activeView]}
              <span className="ml-1.5 font-normal text-neutral-400">{result.markets.length}</span>
            </h2>
            <div className="flex items-center gap-1.5">
              <TunePanel
                weights={weights}
                onWeights={changeWeights}
                prize={prize}
                onPrize={changePrize}
                showPrize={result.opportunity_available && view === "overall"}
                busy={reranking}
                extra={
                  <div className="space-y-3">
                    <div>
                      <p className="mb-1.5 text-xs font-medium text-neutral-700">Compare all markets by</p>
                      <FactorChips active={factorOpen ? panel : null} onPick={openFactorPanel} />
                    </div>
                    {result.opportunity_available && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-neutral-700">Show as</p>
                        <Segmented
                          size="sm"
                          label="Layout"
                          value={layout}
                          onChange={setLayout}
                          options={[
                            { key: "list", label: "List", title: "List" },
                            { key: "map", label: "Map", title: "Opportunity map" },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                }
              />
            </div>
          </div>
          <div className={`scroll-thin min-h-0 flex-1 overflow-y-auto p-3 transition-opacity ${reranking ? "opacity-60" : ""}`}>
            {layout === "map" && result.opportunity_available ? (
              <OpportunityMap markets={result.markets} selected={selected} onSelect={(c) => selectMarket(c)} />
            ) : (
              <MarketList
                markets={result.markets}
                kind={result.category.kind}
                selected={selected}
                onSelect={(c) => selectMarket(c)}
                onFactor={(k) => openFactorPanel(k)}
                view={activeView}
                weights={weights}
              />
            )}
            {result.category.kind === "goods" && <MoreMarkets hsCode={result.lookup?.product?.hs6 ?? result.category.hs_code} category={result.category.id} />}
          </div>
        </aside>

        {/* ---------- right: market or factor panel ---------- */}
        <main ref={panelRef} className="scroll-thin min-h-0 overflow-y-auto p-4 sm:p-6">
          <div className="reveal-panel glass mx-auto max-w-4xl rounded-2xl border border-white/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_40px_-18px_rgba(213,43,30,0.25)] ring-1 ring-neutral-900/[0.05] sm:p-7">
            {factorOpen ? (
              <FactorPanel
                key={panel}
                factorKey={panel}
                markets={result.markets}
                weights={weights}
                onWeight={(k, v) => changeWeights({ ...weights, [k]: v })}
                onPickMarket={(c) => selectMarket(c, panel)}
                onClose={() => setPanel("market")}
              />
            ) : market ? (
              <MarketPanel
                key={market.country_code}
                market={market}
                markets={result.markets}
                profile={result.profile}
                kind={result.category.kind}
                weights={weights}
                openFactor={openFactor}
                onOpenFactor={setOpenFactor}
                onExploreFactor={openFactorPanel}
                anyProduct={Boolean(result.lookup)}
              />
            ) : (
              <p className="text-sm text-neutral-500">Pick a market on the left.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function TopBar({ health, result, description, setDescription, onAnalyze, onReset, loading }) {
  const { profile, category, mode } = result;
  return (
    <header className="glass flex flex-wrap items-center gap-3 border-b border-neutral-900/[0.06] px-4 py-2.5 sm:px-5">
      <button type="button" onClick={onReset} className="shrink-0" aria-label="New search">
        <Logo />
      </button>

      <form
        className="order-last flex w-full items-center gap-2 sm:order-none sm:w-auto sm:flex-1 sm:max-w-md"
        onSubmit={(e) => {
          e.preventDefault();
          onAnalyze();
        }}
      >
        <label className="flex h-9 flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm focus-within:border-neutral-300 focus-within:bg-white">
          <Icon name="search" className="h-4 w-4 text-neutral-400" />
          <span className="sr-only">Describe your business</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe another product…"
            className="w-full bg-transparent outline-none placeholder:text-neutral-400"
          />
        </label>
        <Button type="submit" size="sm" disabled={loading || description.trim().length < 10}>
          {loading ? <Spinner /> : "Go"}
        </Button>
      </form>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 text-xs text-neutral-500">
        <Badge tone="neutral" className="!text-xs">
          {category.label}
        </Badge>
        {profile.company_name && <span className="truncate">{profile.company_name}</span>}
        {(profile.city || profile.province) && <span className="hidden truncate md:inline">· {[profile.city, profile.province].filter(Boolean).join(", ")}</span>}
        {mode === "offline" && <Badge tone="accent">Offline mode: keyword match</Badge>}
        <span className="ml-2 hidden sm:inline">
          <HealthPill health={health} />
        </span>
      </div>
    </header>
  );
}

/**
 * Any-product mode: the HS code Portage picked for the founder's description, with the alternatives and a
 * search to switch. Everything below re-ranks for the chosen code.
 */
function HsStrip({ lookup, onSwitch, busy }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState(null);
  const p = lookup.product;
  const code = (c) => `${c.slice(0, 4)}.${c.slice(4)}`;
  const options = [...lookup.candidates];
  if (!options.some((c) => c.hs6 === p.hs6)) options.unshift({ hs6: p.hs6, description: p.description, source: "user" });

  async function search(e) {
    e.preventDefault();
    if (q.trim().length < 2) return;
    try {
      setHits(await api.lookupSearch(q.trim()));
    } catch {
      setHits([]);
    }
  }

  return (
    <div className="border-b border-amber-100 bg-amber-50/50 px-4 py-2.5 text-sm sm:px-5" aria-label="Product code">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-amber-800">Any-product mode</span>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-neutral-600">Product code</span>
          <select
            aria-label="HS code"
            value={p.hs6}
            disabled={busy}
            onChange={(e) => onSwitch(e.target.value)}
            className="min-w-0 max-w-full flex-1 truncate rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
          >
            {options.map((c) => (
              <option key={c.hs6} value={c.hs6}>
                HS {code(c.hs6)} · {c.description.slice(0, 90)}
              </option>
            ))}
          </select>
        </label>
        <form onSubmit={search} className="flex items-center gap-1.5">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Not right? Search codes"
            aria-label="Search HS codes"
            className="w-44 rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
          />
          <Button type="submit" size="sm" variant="outline" disabled={busy}>
            Search
          </Button>
        </form>
        {busy && <Spinner />}
      </div>
      {hits && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {hits.length === 0 && <span className="text-xs text-neutral-500">No matching codes.</span>}
          {hits.slice(0, 8).map((h) => (
            <button
              key={h.hs6}
              type="button"
              onClick={() => {
                setHits(null);
                onSwitch(h.hs6);
              }}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 text-xs hover:border-neutral-400"
            >
              HS {code(h.hs6)} · {h.description.slice(0, 60)}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-xs text-neutral-500">
        Tariffs and trade data come live from official sources ({p.tariff_source}; {p.trade_source}). Compliance is only as good as its badge:
        confirm anything not marked Verified.
      </p>
    </div>
  );
}
