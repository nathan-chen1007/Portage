import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api.js";
import { UNITY_RED } from "../lib/together.js";
import { Arrow, Eyebrow, HealthPill, Logo } from "./Brand.jsx";
import { AboutPage, FaqPage, MissionPage } from "./SitePages.jsx";
import { Button, ErrorNote, Spinner } from "./ui.jsx";

export const EXAMPLES = [
  {
    label: "Honey producer, Alberta",
    color: "#eda100",
    text: "We're Prairie Gold Apiaries, a family beekeeping operation near Falher, Alberta. We sell raw creamed clover honey in 500 g jars and 20 kg pails. Most of our sales used to go to the US. Contact: Dana Morin, dana@prairiegold.ca",
  },
  {
    label: "Icewine, Niagara",
    color: "#7c3aed",
    text: "We're a small family winery in Niagara-on-the-Lake, Ontario. We make Vidal and Cabernet Franc icewine in 200 ml and 375 ml bottles, about 2,000 cases a year. The US was our biggest export market. Contact: Sam Lee, sam@example.ca",
  },
];

/** "Canada" / "Canadian" highlighted in Canada red. */
const CA = (word) => <span className="font-medium text-brand">{word}</span>;

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
    desc: "Ranks markets by tariffs, rules, shipping, risk and tax, and by how much they buy. Every figure has a source.",
    color: "#2a78d6",
    icon: <path d="M4 16V11M10 16V5M16 16V8" />,
  },
  {
    title: "Paperwork drafts",
    desc: "Pre-fills the documents each market requires, using what you told us.",
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
    desc: "Finds importers and drafts a first email and a voice note in their language.",
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
    desc: (
      <>
        Groups {CA("Canadian")} businesses heading to the same market so they can share shipping costs.
      </>
    ),
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
  { n: "1", title: "Describe your business", body: "A few sentences on what you sell and where you're based." },
  { n: "2", title: "Compare markets", body: "See every market ranked, and adjust what matters most to you." },
  { n: "3", title: "Act on the best one", body: "Open a market for its paperwork, importers and shipping group." },
];


function Home({ categories: allCategories, description, setDescription, onAnalyze, onPickCategory, loading, error, unsupported, inputRef, go, onStart }) {
  const canSubmit = description.trim().length >= 10 && !loading;
  const categories = allCategories.filter((c) => c.kind === "goods"); // products only on the landing page
  return (
    <main>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden border-b border-neutral-200">
        <div className="hero-wash pointer-events-none absolute inset-0" aria-hidden />
        <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[3.5rem]">
              Find the right export market for your <span className="text-brand">Canadian</span> business.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
              Describe what you sell. Portage ranks export markets, drafts the paperwork, and connects you with other Canadian businesses shipping the same way to reduce costs.
            </p>

            <form
              id="start"
              className="mt-8 scroll-mt-28"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) onAnalyze();
              }}
            >
              <div className="rounded-2xl border border-neutral-900/10 bg-white/85 p-2 shadow-[0_12px_40px_-20px_rgba(213,43,30,0.45)] backdrop-blur transition-all focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10">
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
                <div className="flex justify-end px-1 pb-1">
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

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-neutral-500">
                <span>Try an example:</span>
                {EXAMPLES.map((ex) => (
                  <button
                    type="button"
                    key={ex.label}
                    onClick={() => setDescription(ex.text)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: ex.color }} aria-hidden />
                    {ex.label}
                  </button>
                ))}
              </div>

              {categories.length > 0 && (
                <p className="mt-2 text-sm text-neutral-500">
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
                  {categories.map((c) => c.label).join(", ") || "honey and icewine"}.
                </p>
              </div>
            )}
          </div>

          <NetworkDiagram />
        </div>
      </section>

      {/* ---------- features ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">What Portage does</h2>
        <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title}>
              <span className="grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${f.color}14` }}>
                <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {f.icon}
                </svg>
              </span>
              <h3 className="mt-4 flex items-center gap-2 font-semibold">
                {f.title}
                {f.preview && <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-500">Preview</span>}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="scroll-mt-16 border-t border-neutral-200 bg-gradient-to-b from-brand-50/70 to-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="flex gap-4">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white shadow-[0_4px_12px_-4px_rgba(213,43,30,0.6)]">{s.n}</span>
                <div>
                  <h3 className="font-semibold">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-12">
            <Button size="lg" onClick={onStart} className="rounded-xl">
              Get started <Arrow className="h-4 w-4" />
            </Button>
          </div>
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
    <div className="glass mx-auto w-full max-w-md rounded-2xl border border-white/70 p-5 shadow-[0_18px_50px_-24px_rgba(213,43,30,0.35)] ring-1 ring-neutral-900/[0.05] lg:max-w-none" aria-hidden>
      <div className="grid grid-cols-3 text-[11px] font-medium uppercase tracking-wider text-neutral-400">
        <span>Businesses</span>
        <span className="text-center">Portage</span>
        <span className="text-right">Markets</span>
      </div>
      <svg viewBox="0 0 420 340" className="mt-2 w-full">
        {PRODUCERS.map((y) => (
          <path key={y} d={`M44 ${y} C 130 ${y}, 120 ${hub.y}, ${hub.x - 40} ${hub.y}`} fill="none" stroke="#d52b1e" strokeOpacity="0.5" strokeWidth="1.4" className="flow" />
        ))}
        {MARKETS.map((m, i) => (
          <path key={m} d={`M${hub.x + 40} ${hub.y} C 300 ${hub.y}, 300 ${mY(i)}, 356 ${mY(i)}`} fill="none" stroke={UNITY_RED} strokeWidth="1.4" className="flow" />
        ))}
        {PRODUCERS.map((y, i) => (
          <g key={y} className="node-pop" style={{ animationDelay: `${i * 0.06}s` }}>
            <circle cx="32" cy={y} r="12" fill="#fff" stroke="#d4d4d4" />
            <circle cx="32" cy={y} r="4.5" fill="#d52b1e" />
          </g>
        ))}
        <rect x={hub.x - 40} y={hub.y - 22} width="80" height="44" rx="12" fill="#d52b1e" />
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
        Businesses heading to the same market can ship together.
      </p>
    </div>
  );
}

/* ---------------- footer ---------------- */

function SiteFooter({ go, onHow }) {
  const links = [
    ["How it works", onHow],
    ["Mission", () => go("mission")],
    ["About us", () => go("about")],
    ["FAQ", () => go("faq")],
  ];
  return (
    <footer className="border-t border-neutral-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-8 sm:px-6">
        <Logo />
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          {links.map(([label, fn]) => (
            <button key={label} type="button" onClick={fn} className="text-sm text-neutral-500 transition-colors hover:text-neutral-900">
              {label}
            </button>
          ))}
        </nav>
        <span className="text-xs text-neutral-400">© 2026 Portage · AF Hacks: Growing {CA("Canada")}</span>
      </div>
    </footer>
  );
}
