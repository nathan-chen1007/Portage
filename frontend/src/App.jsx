import { useEffect, useRef, useState } from "react";
import { API_URL, DEFAULT_PRIZE_WEIGHT, DEFAULT_WEIGHTS, api, emptyProfile } from "./lib/api.js";
import { FactorChips } from "./components/FrictionBar.jsx";
import { FactorPanel } from "./components/FactorPanel.jsx";
import { LoadingScreen } from "./components/LoadingScreen.jsx";
import { MarketList } from "./components/MarketList.jsx";
import { MarketPanel } from "./components/MarketPanel.jsx";
import { OpportunityMap } from "./components/OpportunityMap.jsx";
import { TunePanel } from "./components/TunePanel.jsx";
import { Badge, Button, ErrorNote, Icon, Segmented, Spinner } from "./components/ui.jsx";
import { COMPONENTS, VIEWS } from "./lib/format.js";

export const EXAMPLES = [
  {
    label: "Honey producer, Alberta",
    text: "We're Prairie Gold Apiaries, a family beekeeping operation near Falher, Alberta. We sell raw creamed clover honey in 500 g jars and 20 kg pails. Most of our sales used to go to the US. Contact: Dana Morin, dana@prairiegold.ca",
  },
  {
    label: "HR software, Waterloo",
    text: "Northwind HR is a Waterloo startup selling cloud HR analytics software to mid-size companies. We store employee records, performance reviews and payroll data for our customers. Contact: Sam Lee, sam@northwindhr.com",
  },
];

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

/* ---------------------------------------------------------------- */

function Landing({ health, categories, description, setDescription, onAnalyze, onPickCategory, loading, error, unsupported }) {
  const canSubmit = description.trim().length >= 10 && !loading;
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <HealthPill health={health} />
      </header>

      {health === "down" && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <ErrorNote>
            Can't reach the backend{API_URL ? ` at ${API_URL}` : ""}. Start it with <code>backend\run.bat</code>, then refresh this page.
          </ErrorNote>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-24">
        <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Built for Canadian exporters
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-6xl">Find your next market.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-neutral-500">
          Describe what you sell. Portage ranks every market by how much it buys and how hard it is to enter, then drafts the paperwork and your
          first message to a real importer.
        </p>

        <form
          className="mt-10 text-left"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) onAnalyze();
          }}
        >
          <div className="rounded-2xl border border-neutral-200 bg-white p-2 shadow-[0_2px_12px_rgba(0,0,0,0.05)] transition-shadow focus-within:border-neutral-300 focus-within:shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
            <label htmlFor="description" className="sr-only">
              Describe your business
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onAnalyze();
              }}
              placeholder="What does your company sell, and where are you based?"
              rows={4}
              className="w-full resize-none rounded-xl p-3 text-base outline-none placeholder:text-neutral-400"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex.label}
                    onClick={() => setDescription(ex.text)}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition-all hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
              <Button type="submit" size="lg" disabled={!canSubmit}>
                {loading ? (
                  <>
                    <Spinner /> Analyzing
                  </>
                ) : (
                  "Find my markets"
                )}
              </Button>
            </div>
          </div>

          {categories.length > 0 && (
            <p className="mt-4 text-center text-xs text-neutral-500">
              Or browse a category:{" "}
              {categories.map((c, i) => (
                <span key={c.id}>
                  {i > 0 && " · "}
                  <button type="button" onClick={() => onPickCategory(c)} className="font-medium text-neutral-700 underline underline-offset-2 hover:text-neutral-900">
                    {c.label}
                  </button>
                </span>
              ))}
            </p>
          )}
          <div className="mt-4">
            <ErrorNote>{error}</ErrorNote>
          </div>
        </form>

        {unsupported && !loading && (
          <div className="fade-up mt-10 rounded-2xl border border-neutral-200 p-6">
            <p className="font-medium">We don't have verified data for that product yet.</p>
            <p className="mt-1 text-sm text-neutral-500">
              We only show sourced tariff and regulatory data, never guesses. Supported today:{" "}
              {categories.map((c) => c.label).join(" and ") || "honey and B2B software"}.
            </p>
          </div>
        )}

        <div className="mt-16 grid gap-4 text-left sm:grid-cols-3">
          {[
            ["Ranked, not listed", "Every market scored on tariffs, rules, shipping, risk and tax, with the source behind each number."],
            ["Paperwork, drafted", "Origin declarations and data agreements filled from what you told us."],
            ["A foot in the door", "A first email to a real importer, plus a voice note in their language."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-2xl border border-neutral-100 bg-neutral-50/60 p-4">
              <p className="text-sm font-semibold">{t}</p>
              <p className="mt-1 text-sm text-neutral-500">{d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        Portage · AF Hacks: Growing Canada 2026 · Every figure links to its source.
      </footer>
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

function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <img src="/favicon.svg" alt="" className="h-6 w-6" />
      Portage
    </span>
  );
}

function HealthPill({ health }) {
  if (health === "checking") return <span className="text-xs text-neutral-400">Connecting…</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
      <span className={`h-1.5 w-1.5 rounded-full ${health === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
      {health === "ok" ? "Live data" : "Backend offline"}
    </span>
  );
}
