import { useEffect, useRef, useState } from "react";
import { DEFAULT_PRIZE_WEIGHT, DEFAULT_WEIGHTS, api, emptyProfile } from "./lib/api.js";
import { FactorChips } from "./components/FrictionBar.jsx";
import { FactorPanel } from "./components/FactorPanel.jsx";
import { LoadingScreen } from "./components/LoadingScreen.jsx";
import { MarketList } from "./components/MarketList.jsx";
import { MarketPanel } from "./components/MarketPanel.jsx";
import { OpportunityMap } from "./components/OpportunityMap.jsx";
import { TunePanel } from "./components/TunePanel.jsx";
import { HealthPill, Logo } from "./components/Brand.jsx";
import { Landing } from "./components/Landing.jsx";
import { Badge, Button, Icon, Segmented, Spinner } from "./components/ui.jsx";
import { COMPONENTS, VIEWS } from "./lib/format.js";

export { EXAMPLES } from "./components/Landing.jsx";

const HEADINGS = { overall: "Best bet first", friction: "Easiest first", opportunity: "Biggest prize first" };

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
    const firstOpen = r.markets.find((m) => m.status !== "blocked") ?? r.markets[0];
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

  // Re-rank on the backend with the current controls (any argument overrides the current state).
  function rerank({ weights: w = weights, view: v = view, prize: p = prize } = {}) {
    if (!result?.category) return;
    clearTimeout(rerankTimer.current);
    rerankTimer.current = setTimeout(async () => {
      if (Object.values(w).every((x) => x === 0)) return;
      setReranking(true);
      try {
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
    <div key={revealKey} className="reveal flex min-h-screen flex-col bg-white text-neutral-900 lg:h-screen lg:overflow-hidden">
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

      {error && (
        <div className="border-b border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      <div className="grid min-h-0 flex-1 lg:grid-cols-[27rem_1fr]">
        {/* ---------- left: controls + ranked list ---------- */}
        <aside className="reveal-left flex min-h-0 flex-col border-neutral-200 lg:border-r">
          <div className="space-y-3 border-b border-neutral-100 p-4">
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
              <p className="text-xs text-neutral-500">
                Ranked by ease of entry. Opportunity needs customs trade data, which doesn't exist for software.
              </p>
            )}
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">Explore a factor</p>
              <FactorChips active={factorOpen ? panel : null} onPick={openFactorPanel} />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 px-4 pb-1 pt-3">
            <div>
              <h2 className="text-sm font-semibold">{HEADINGS[activeView]}</h2>
              <span className="text-[11px] text-neutral-400">{result.markets.length} markets</span>
            </div>
            <div className="flex items-center gap-1.5">
              {result.opportunity_available && (
                <Segmented
                  size="sm"
                  label="Layout"
                  value={layout}
                  onChange={setLayout}
                  options={[
                    { key: "list", label: <Icon name="list" className="h-3.5 w-3.5" />, title: "List" },
                    { key: "map", label: <Icon name="map" className="h-3.5 w-3.5" />, title: "Opportunity map" },
                  ]}
                />
              )}
              <TunePanel
                weights={weights}
                onWeights={changeWeights}
                prize={prize}
                onPrize={changePrize}
                showPrize={result.opportunity_available && view === "overall"}
                busy={reranking}
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
          </div>
        </aside>

        {/* ---------- right: market or factor panel ---------- */}
        <main ref={panelRef} className="scroll-thin min-h-0 overflow-y-auto bg-neutral-50/70 p-4 sm:p-6">
          <div className="reveal-panel mx-auto max-w-4xl rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] sm:p-7">
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
                profile={result.profile}
                kind={result.category.kind}
                weights={weights}
                openFactor={openFactor}
                onOpenFactor={setOpenFactor}
                onExploreFactor={openFactorPanel}
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
    <header className="flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2.5 backdrop-blur sm:px-5">
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
        {category.hs_code && <span className="hidden md:inline">· HS {category.hs_code}</span>}
        {mode === "offline" && <Badge tone="accent">Offline mode: keyword match</Badge>}
        <span className="ml-2 hidden sm:inline">
          <HealthPill health={health} />
        </span>
      </div>
    </header>
  );
}
