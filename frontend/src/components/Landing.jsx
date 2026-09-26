import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api.js";
import { UNITY_RED } from "../lib/together.js";
import { Arrow, Eyebrow, HealthPill, Logo } from "./Brand.jsx";
import { AboutPage, FaqPage, MissionPage } from "./SitePages.jsx";
import { Button, ErrorNote, Spinner, useDismiss } from "./ui.jsx";

export const EXAMPLES = [
  {
    label: "Honey producer, Alberta",
    color: "#eda100",
    text: "We're Prairie Gold Apiaries, a family beekeeping operation near Falher, Alberta. We sell raw creamed clover honey in 500 g jars and 20 kg pails. Most of our sales used to go to the US. Contact: Dana Morin, dana@prairiegold.ca",
  },
  {
    label: "HR software, Waterloo",
    color: "#2a78d6",
    text: "Northwind HR is a Waterloo startup selling cloud HR analytics software to mid-size companies. We store employee records, performance reviews and payroll data for our customers. Contact: Sam Lee, sam@northwindhr.com",
  },
];

/* ---------------- tiny hash router: #/mission, #/about, #/faq ---------------- */

const PAGES = ["mission", "about", "faq"];
const readHash = () => {
  const h = (typeof window !== "undefined" ? window.location.hash : "").replace(/^#\/?/, "");
  return PAGES.includes(h) ? h : "home";
};
const toTop = () => {
  try {
    window.scrollTo({ top: 0 });
  } catch {
    /* jsdom */
  }
};

function useHashPage() {
  const [page, setPage] = useState(readHash);
  useEffect(() => {
    const on = () => {
      setPage(readHash());
      toTop();
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (p) => {
    const hash = p === "home" ? "#/" : `#/${p}`;
    if (window.location.hash !== hash) window.location.hash = hash;
    setPage(p);
    toTop();
  };
  return [page, go];
}

const later = (fn) => setTimeout(fn, 60);

/* ---------------- page ---------------- */

export function Landing(props) {
  const { health } = props;
  const [page, go] = useHashPage();
  const inputRef = useRef(null);

  function start() {
    if (page !== "home") go("home");
    later(() => {
      document.getElementById("start")?.scrollIntoView?.({ behavior: "smooth", block: "center" });
      inputRef.current?.focus({ preventScroll: true });
    });
  }
  function how() {
    if (page !== "home") go("home");
    later(() => document.getElementById("how")?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  }

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <SiteNav page={page} go={go} onHow={how} onStart={start} health={health} />

      {health === "down" && (
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
          <ErrorNote>
            Can't reach the backend{API_URL ? ` at ${API_URL}` : ""}. Start it with <code>backend\run.bat</code>, then refresh this page.
          </ErrorNote>
        </div>
      )}

      <div key={page} className="fade-in">
        {page === "mission" ? (
          <MissionPage onStart={start} />
        ) : page === "about" ? (
          <AboutPage onStart={start} />
        ) : page === "faq" ? (
          <FaqPage onStart={start} />
        ) : (
          <Home {...props} inputRef={inputRef} go={go} onStart={start} />
        )}
      </div>

      <SiteFooter go={go} onHow={how} onStart={start} />
    </div>
  );
}

/* ---------------- navigation ---------------- */

function SiteNav({ page, go, onHow, onStart, health }) {
  const [menu, setMenu] = useState(false);
  const [signin, setSignin] = useState(false);
  const signRef = useDismiss(signin, () => setSignin(false));

  const links = [
    { key: "how", label: "How it works", onClick: onHow },
    { key: "mission", label: "Mission", onClick: () => go("mission") },
    { key: "about", label: "About us", onClick: () => go("about") },
    { key: "faq", label: "FAQ", onClick: () => go("faq") },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/85 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <button type="button" onClick={() => go("home")} aria-label="Portage home" className="shrink-0">
          <Logo />
        </button>

        <nav aria-label="Main" className="hidden items-center gap-0.5 md:flex">
          {links.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={l.onClick}
              aria-current={page === l.key ? "page" : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                page === l.key ? "bg-neutral-100 font-medium text-neutral-900" : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
              }`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <span className="mr-2 hidden lg:inline-flex">
            <HealthPill health={health} />
          </span>
          <div ref={signRef} className="relative hidden sm:block">
            <Button variant="ghost" size="sm" onClick={() => setSignin((o) => !o)} aria-expanded={signin}>
              Sign in
            </Button>
            {signin && (
              <div className="pop absolute right-0 top-11 w-72 rounded-xl border border-neutral-200 bg-white p-4 text-sm shadow-lg">
                <p className="font-semibold">Accounts aren't available yet</p>
                <p className="mt-1 text-neutral-600">You can use Portage without one.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSignin(false);
                    onStart();
                  }}
                  className="mt-3 inline-flex items-center gap-1 font-medium text-neutral-900 hover:underline"
                >
                  Start without an account <Arrow className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <Button size="sm" onClick={onStart}>
            Get started <Arrow className="h-3.5 w-3.5" />
          </Button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-100 md:hidden"
            aria-label="Menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              {menu ? <path d="M5 5l10 10M15 5L5 15" /> : <path d="M3 6h14M3 10h14M3 14h14" />}
            </svg>
          </button>
        </div>
      </div>

      {menu && (
        <nav aria-label="Mobile" className="fade-in border-t border-neutral-200 px-4 py-3 md:hidden">
          {links.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => {
                setMenu(false);
                l.onClick();
              }}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-[15px] ${page === l.key ? "bg-neutral-100 font-medium" : "text-neutral-600"}`}
            >
              {l.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  );
}

/* ---------------- home ---------------- */

const FEATURES = [
  {
    title: "Market ranking",
    desc: "Scores each market on tariffs, compliance, logistics, risk and tax, and sizes how much of your product it buys. Every figure links to its official source.",
    color: "#2a78d6",
    icon: <path d="M4 16V11M10 16V5M16 16V8" />,
  },
  {
    title: "Paperwork drafts",
    desc: "Lists the documents each market requires and pre-fills them from your description, such as certificates of origin for goods or data processing agreements for software.",
    color: "#eb6834",
    icon: (
      <>
        <path d="M5 2.5h6.5L15 6v11.5H5z" />
        <path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5" />
      </>
    ),
  },
  {
    title: "Importer outreach",
    desc: "Finds importers in the market and drafts a first email to them, plus a voice note in the buyer's language. Nothing is sent until you send it.",
    color: "#1baf7a",
    icon: (
      <>
        <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
        <path d="M3 5.5l7 5.5 7-5.5" />
      </>
    ),
  },
  {
    title: "Ship together",
    desc: "Shows other Canadian businesses heading to the same market, so you can share a container, split customs broker fees and meet larger order minimums.",
    color: UNITY_RED,
    preview: true,
    icon: (
      <>
        <circle cx="5" cy="10" r="3.2" fill={UNITY_RED} stroke="#fff" strokeWidth="1.2" />
        <circle cx="10" cy="10" r="3.2" fill={UNITY_RED} stroke="#fff" strokeWidth="1.2" opacity=".75" />
        <circle cx="15" cy="10" r="3.2" fill={UNITY_RED} stroke="#fff" strokeWidth="1.2" opacity=".5" />
      </>
    ),
  },
];

const STEPS = [
  { n: "1", title: "Describe your business", body: "Write a few sentences about what you sell and where you're based. Portage identifies your product and its trade classification." },
  { n: "2", title: "Compare markets", body: "See markets ranked by ease of entry and market size. Change how much each factor counts and the ranking updates." },
  { n: "3", title: "Take the next step", body: "Open a market to get its paperwork, importer contacts and a group of Canadian businesses to ship with." },
];

const FACTS = [
  ["8", "export markets compared"],
  ["5", "entry factors scored"],
  ["1", "search to compare them all"],
];

function Home({ categories, description, setDescription, onAnalyze, onPickCategory, loading, error, unsupported, inputRef, go, onStart }) {
  const canSubmit = description.trim().length >= 10 && !loading;
  return (
    <main>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-neutral-200">
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: UNITY_RED }} /> For Canadian exporters
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.5rem]">Find the right export market for your business.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
              Describe what you sell. Portage ranks international markets by how easy they are to enter and how much they buy, drafts the paperwork, and connects you
              with other Canadian businesses shipping to the same place.
            </p>

            <form
              id="start"
              className="mt-8 scroll-mt-28"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) onAnalyze();
              }}
            >
              <div className="rounded-2xl border border-neutral-300 bg-white p-2 shadow-sm transition-all focus-within:border-neutral-900 focus-within:shadow-md">
                <label htmlFor="description" className="sr-only">
                  Describe your business
                </label>
                <textarea
                  id="description"
                  ref={inputRef}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canSubmit) onAnalyze();
                  }}
                  placeholder="What does your company sell, and where are you based?"
                  rows={4}
                  className="w-full resize-none rounded-xl bg-transparent p-3 text-base outline-none placeholder:text-neutral-400"
                />
                <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-1">
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map((ex) => (
                      <button
                        type="button"
                        key={ex.label}
                        onClick={() => setDescription(ex.text)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ex.color }} aria-hidden />
                        {ex.label}
                      </button>
                    ))}
                  </div>
                  <Button type="submit" size="lg" disabled={!canSubmit} className="rounded-xl">
                    {loading ? (
                      <>
                        <Spinner /> Analyzing
                      </>
                    ) : (
                      <>
                        Find my markets
                        <Arrow className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {categories.length > 0 && (
                <p className="mt-4 text-sm text-neutral-500">
                  Or browse a category:{" "}
                  {categories.map((c, i) => (
                    <span key={c.id}>
                      {i > 0 && " · "}
                      <button type="button" onClick={() => onPickCategory(c)} className="font-medium text-neutral-800 underline underline-offset-4 hover:text-neutral-950">
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
              <div className="fade-up mt-6 rounded-2xl border border-neutral-200 bg-white p-6">
                <p className="font-medium">We don't have verified data for that product yet.</p>
                <p className="mt-1 text-sm text-neutral-500">
                  We only show sourced tariff and regulatory data, never guesses. Supported today:{" "}
                  {categories.map((c) => c.label).join(" and ") || "honey and B2B software"}.
                </p>
              </div>
            )}
          </div>

          <NetworkDiagram />
        </div>
      </section>

      {/* ---------- key facts ---------- */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <dl className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-neutral-200 px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {FACTS.map(([v, l]) => (
            <div key={l} className="flex items-baseline gap-3 py-6 sm:justify-center">
              <dt className="text-3xl font-semibold tracking-tight">{v}</dt>
              <dd className="text-sm text-neutral-600">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ---------- features ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>What Portage does</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">From choosing a market to your first shipment.</h2>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card-hover rounded-2xl border bg-white p-6" style={{ borderColor: `${f.color}40` }}>
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${f.color}14` }}>
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {f.icon}
                  </svg>
                </span>
                {f.preview && <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">Preview</span>}
              </div>
              <h3 className="mt-5 text-lg font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-16 border-y border-neutral-200 bg-neutral-50">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <div className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Three steps. A few minutes.</h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="rounded-2xl border border-neutral-200 bg-white p-6">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-neutral-900 text-sm font-semibold text-white">{s.n}</span>
                <h3 className="mt-5 text-lg font-semibold tracking-tight">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- together band ---------- */}
      <section className="px-4 py-24 sm:px-6">
        <div className="relative mx-auto grid max-w-6xl gap-10 overflow-hidden rounded-3xl bg-neutral-950 px-6 py-14 text-white sm:px-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div className="band-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative">
            <Eyebrow className="text-neutral-400">Ship together</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Canadian businesses are stronger together.</h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-300">
              Most small producers can't fill a shipping container or meet an importer's minimum order alone. Portage groups businesses heading to the same market so they
              can share the cost. Each business keeps its own paperwork and pays its own share.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onStart}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
              >
                Get started <Arrow className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => go("mission")}
                className="inline-flex h-11 items-center rounded-xl border border-white/20 px-5 text-[15px] font-medium text-white transition-colors hover:bg-white/10"
              >
                Read our mission
              </button>
            </div>
          </div>
          <ul className="relative space-y-3">
            {[
              ["Shared freight", "Fill one container instead of paying for part of one."],
              ["Shared customs broker", "Split the broker and forwarding fees across the group."],
              ["Combined volume", "Meet the minimum order an importer needs, together."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-4">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: UNITY_RED }} />
                <span>
                  <span className="block font-semibold">{t}</span>
                  <span className="text-sm text-neutral-400">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}

/* ---------------- hero visual: businesses -> Portage -> markets ---------------- */

const PRODUCERS = [70, 125, 180, 235, 290];
const MARKETS = ["US", "GB", "DE", "JP", "KR", "CN", "AU", "MX"];

function NetworkDiagram() {
  const hub = { x: 214, y: 180 };
  const mY = (i) => 54 + i * 36;
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-5 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.18)] lg:max-w-none" aria-hidden>
      <div className="grid grid-cols-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        <span>Canadian businesses</span>
        <span className="text-center">Portage</span>
        <span className="text-right">Markets</span>
      </div>
      <svg viewBox="0 0 420 340" className="mt-2 w-full">
        {PRODUCERS.map((y) => (
          <path key={y} d={`M44 ${y} C 130 ${y}, 120 ${hub.y}, ${hub.x - 40} ${hub.y}`} fill="none" stroke="#a3a3a3" strokeWidth="1.4" className="flow" />
        ))}
        {MARKETS.map((m, i) => (
          <path key={m} d={`M${hub.x + 40} ${hub.y} C 300 ${hub.y}, 300 ${mY(i)}, 356 ${mY(i)}`} fill="none" stroke={UNITY_RED} strokeWidth="1.4" className="flow" />
        ))}
        {PRODUCERS.map((y, i) => (
          <g key={y} className="node-pop" style={{ animationDelay: `${i * 0.06}s` }}>
            <circle cx="32" cy={y} r="12" fill="#fff" stroke="#d4d4d4" />
            <circle cx="32" cy={y} r="4.5" fill="#171717" />
          </g>
        ))}
        <rect x={hub.x - 40} y={hub.y - 22} width="80" height="44" rx="12" fill="#171717" />
        <text x={hub.x} y={hub.y + 5} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff" fontFamily="Inter, sans-serif">
          Portage
        </text>
        {MARKETS.map((m, i) => (
          <g key={m} className="node-pop" style={{ animationDelay: `${0.3 + i * 0.05}s` }}>
            <rect x="358" y={mY(i) - 13} width="46" height="26" rx="7" fill="#fff" stroke="#d4d4d4" />
            <text x="381" y={mY(i) + 4.5} textAnchor="middle" fontSize="12" fontWeight="600" fill="#262626" fontFamily="Inter, sans-serif">
              {m}
            </text>
          </g>
        ))}
      </svg>
      <p className="mt-2 border-t border-neutral-100 pt-4 text-sm text-neutral-600">
        One search compares every market. Businesses heading to the same one can ship together.
      </p>
    </div>
  );
}

/* ---------------- footer ---------------- */

function SiteFooter({ go, onHow, onStart }) {
  const col = (title, items) => (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      <ul className="mt-4 space-y-2.5">
        {items.map(([label, fn]) => (
          <li key={label}>
            <button type="button" onClick={fn} className="text-sm text-neutral-600 transition-colors hover:text-neutral-900">
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-neutral-600">
            Export market research, paperwork and shared shipping for Canadian small businesses.
          </p>
        </div>
        {col("Product", [
          ["How it works", onHow],
          ["Get started", onStart],
        ])}
        {col("Company", [
          ["Mission", () => go("mission")],
          ["About us", () => go("about")],
          ["FAQ", () => go("faq")],
        ])}
      </div>
      <div className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-neutral-500 sm:px-6">
          <span>© 2026 Portage · Built at AF Hacks: Growing Canada, Waterloo</span>
          <span>Every figure links to its official source.</span>
        </div>
      </div>
    </footer>
  );
}
