import { useEffect, useRef, useState } from "react";
import { API_URL, DEFAULT_WEIGHTS, api, emptyProfile } from "./lib/api.js";
import { MarketDetail } from "./components/MarketDetail.jsx";
import { MarketList } from "./components/MarketList.jsx";
import { WeightsPanel } from "./components/WeightsPanel.jsx";
import { Badge, Button, ErrorNote, Skeleton, Spinner } from "./components/ui.jsx";

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

export default function App() {
  const [health, setHealth] = useState("checking"); // checking | ok | down
  const [categories, setCategories] = useState([]);
  const [description, setDescription] = useState("");
  const [result, setResult] = useState(null); // { profile, category, markets, mode }
  const [selected, setSelected] = useState(null);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [loading, setLoading] = useState(false);
  const [reranking, setReranking] = useState(false);
  const [error, setError] = useState(null);
  const resultsRef = useRef(null);
  const detailRef = useRef(null);
  const rerankTimer = useRef(null);

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
    setResult(r);
    setWeights(DEFAULT_WEIGHTS);
    const firstOpen = r.markets.find((m) => m.status !== "blocked") ?? r.markets[0];
    setSelected(firstOpen?.country_code ?? null);
    setTimeout(() => resultsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      showResult(await api.analyze(description.trim()));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function pickCategory(cat) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const markets = await api.rank(cat.id);
      showResult({ profile: emptyProfile(cat.id), category: cat, markets, mode: "direct" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function changeWeights(w) {
    setWeights(w);
    if (!result?.category) return;
    clearTimeout(rerankTimer.current);
    rerankTimer.current = setTimeout(async () => {
      if (Object.values(w).every((v) => v === 0)) return;
      setReranking(true);
      try {
        const markets = await api.rank(result.category.id, w);
        setResult((r) => ({ ...r, markets }));
      } catch (e) {
        setError(e.message);
      } finally {
        setReranking(false);
      }
    }, 250);
  }

  function select(code) {
    setSelected(code);
    setTimeout(() => detailRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 50);
  }

  const market = result?.markets.find((m) => m.country_code === selected);
  const canSubmit = description.trim().length >= 10 && !loading;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <img src="/favicon.svg" alt="" className="h-6 w-6" />
          Portage
        </a>
        <HealthPill health={health} />
      </header>

      {health === "down" && (
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <ErrorNote>
            Can't reach the backend at {API_URL}. Start it from <code>backend/</code> with{" "}
            <code>uvicorn app.main:app --reload --port 8000</code>, then refresh.
          </ErrorNote>
        </div>
      )}

      <main>
        <section className="mx-auto max-w-3xl px-4 pb-12 pt-14 text-center sm:px-6 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Built for Canadian exporters
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Find your next market.</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-neutral-500">
            Describe what you sell. Portage ranks every market by tariffs, regulations and customs friction, then drafts the
            paperwork and your first message to a real importer.
          </p>

          <form
            className="mt-10 text-left"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) analyze();
            }}
          >
            <label htmlFor="description" className="sr-only">
              Describe your business
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) analyze();
              }}
              placeholder="What does your company sell, and where are you based?"
              rows={4}
              className="w-full resize-none rounded-xl border border-neutral-200 p-4 text-base shadow-sm outline-none transition-shadow focus:border-neutral-400 focus:shadow-md"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex.label}
                    onClick={() => setDescription(ex.text)}
                    className="rounded-full border border-neutral-200 px-3 py-1 text-xs text-neutral-600 transition-colors hover:bg-neutral-50"
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
            {categories.length > 0 && (
              <p className="mt-4 text-xs text-neutral-500">
                Or browse a category:{" "}
                {categories.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && " · "}
                    <button type="button" onClick={() => pickCategory(c)} className="underline underline-offset-2 hover:text-neutral-900">
                      {c.label}
                    </button>
                  </span>
                ))}
              </p>
            )}
            <div className="mt-3">
              <ErrorNote>{error}</ErrorNote>
            </div>
          </form>
        </section>

        <div ref={resultsRef} className="mx-auto max-w-5xl scroll-mt-6 space-y-6 px-4 pb-24 sm:px-6">
          {loading && (
            <div className="space-y-3" data-testid="loading">
              <Skeleton className="h-6 w-64" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          )}

          {result && !result.category && (
            <div className="rounded-xl border border-neutral-200 p-6 text-center">
              <p className="font-medium">We don't have verified data for that product yet.</p>
              <p className="mt-1 text-sm text-neutral-500">
                We only show sourced tariff and regulatory data, never guesses. Supported today:{" "}
                {categories.map((c) => c.label).join(" and ") || "honey and B2B software"}.
              </p>
            </div>
          )}

          {result?.category && (
            <>
              <ProfileSummary result={result} />
              <WeightsPanel
                weights={weights}
                onChange={changeWeights}
                onReset={() => changeWeights(DEFAULT_WEIGHTS)}
                busy={reranking}
              />
              <MarketList markets={result.markets} kind={result.category.kind} selected={selected} onSelect={select} />
              <div ref={detailRef} className="scroll-mt-6">
                {market && (
                  <MarketDetail key={market.country_code} market={market} profile={result.profile} kind={result.category.kind} />
                )}
              </div>
            </>
          )}
        </div>
      </main>

      <footer className="border-t border-neutral-100 py-6 text-center text-xs text-neutral-400">
        Portage · AF Hacks: Growing Canada 2026 · Every figure links to its source.
      </footer>
    </div>
  );
}

function HealthPill({ health }) {
  if (health === "checking") return <span className="text-xs text-neutral-400">Connecting…</span>;
  return (
    <span className="flex items-center gap-1.5 text-xs text-neutral-500">
      <span className={`h-1.5 w-1.5 rounded-full ${health === "ok" ? "bg-emerald-500" : "bg-red-500"}`} />
      {health === "ok" ? "Live data" : "Backend offline"}
    </span>
  );
}

function ProfileSummary({ result }) {
  const { profile, category, mode } = result;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
      <span>Reading you as</span>
      <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 font-medium text-neutral-900">{category.label}</span>
      {profile.company_name && <span>· {profile.company_name}</span>}
      {(profile.city || profile.province) && <span>· {[profile.city, profile.province].filter(Boolean).join(", ")}</span>}
      {category.hs_code && <span>· HS {category.hs_code}</span>}
      {mode === "offline" && (
        <Badge tone="accent" className="ml-1">
          Offline mode: keyword match
        </Badge>
      )}
    </div>
  );
}
