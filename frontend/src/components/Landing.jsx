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
const toTop = (behavior = "auto") => {
  try {
    window.scrollTo({ top: 0, behavior });
  } catch {
    /* jsdom */
  }
};

function useHashPage() {
  const [page, setPage] = useState(readHash);
  useEffect(() => {
    const on = () => setPage(readHash());
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
    <div className="min-h-screen bg-paper text-neutral-900 selection:bg-amber-200/70">
      <SiteNav page={page} go={go} onHow={how} onStart={start} health={health} />

      {health === "down" && (
        <div className="mx-auto max-w-3xl px-4 pt-4 sm:px-6">
          <ErrorNote>
            Can't reach the backend{API_URL ? ` at ${API_URL}` : ""}. Start it with <code>backend\run.bat</code>, then refresh this page.
          </ErrorNote>
        </div>
      )}

      <div key={page} className="rise">
        {page === "mission" ? (
          <MissionPage onStart={start} go={go} />
        ) : page === "about" ? (
          <AboutPage onStart={start} go={go} />
        ) : page === "faq" ? (
          <FaqPage onStart={start} go={go} />
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
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  const links = [
    { key: "how", label: "How it works", onClick: onHow },
    { key: "mission", label: "Mission", onClick: () => go("mission") },
    { key: "about", label: "About us", onClick: () => go("about") },
    { key: "faq", label: "FAQ", onClick: () => go("faq") },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-300 ${
        scrolled || menu ? "border-b border-neutral-200/70 bg-paper/80 backdrop-blur-lg" : "border-b border-transparent"
      }`}
    >
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
              className={`relative rounded-lg px-3 py-1.5 text-sm transition-colors ${
                page === l.key ? "font-medium text-neutral-900" : "text-neutral-500 hover:bg-neutral-900/[0.04] hover:text-neutral-900"
              }`}
            >
              {l.label}
              {page === l.key && <span className="absolute inset-x-3 -bottom-[3px] h-0.5 rounded-full bg-accent" />}
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
              <div className="pop absolute right-0 top-11 w-72 rounded-2xl border border-neutral-200 bg-white p-4 text-sm shadow-[0_16px_40px_-12px_rgba(0,0,0,0.25)]">
                <p className="font-semibold">Accounts are coming soon</p>
                <p className="mt-1 text-neutral-500">You don't need one today. Describe your business and Portage gets to work right away.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSignin(false);
                    onStart();
                  }}
                  className="mt-3 inline-flex items-center gap-1 font-medium text-accent hover:gap-2 transition-all"
                >
                  Start without an account <Arrow className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
          <Button size="sm" onClick={onStart} className="group">
            Get started <Arrow className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg text-neutral-600 hover:bg-neutral-900/5 md:hidden"
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
        <nav aria-label="Mobile" className="fade-in border-t border-neutral-200/70 px-4 py-3 md:hidden">
          {links.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => {
                setMenu(false);
                l.onClick();
              }}
              className={`block w-full rounded-lg px-3 py-2.5 text-left text-[15px] ${page === l.key ? "bg-neutral-900/5 font-medium" : "text-neutral-600"}`}
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
    title: "Ranked, not listed",
    desc: "Every market scored on tariffs, rules, shipping, risk and tax, with the source behind each number.",
    color: "#2a78d6",
    tint: "#eef4fc",
    icon: <path d="M4 16V11M10 16V5M16 16V8" />,
  },
  {
    title: "Paperwork, drafted",
    desc: "Origin declarations and data agreements filled in from what you told us.",
    color: "#eb6834",
    tint: "#fdf1ec",
    icon: (
      <>
        <path d="M5 2.5h6.5L15 6v11.5H5z" />
        <path d="M11.5 2.5V6H15M7.5 10h5M7.5 13h5" />
      </>
    ),
  },
  {
    title: "A foot in the door",
    desc: "A first email to a real importer, plus a voice note in their language.",
    color: "#1baf7a",
    tint: "#ecf8f3",
    icon: (
      <>
        <rect x="2.5" y="4.5" width="15" height="11" rx="2" />
        <path d="M3 5.5l7 5.5 7-5.5" />
      </>
    ),
  },
  {
    title: "Canada is stronger together",
    desc: "Pool a shipment with other Canadian producers heading to the same market, and split the costs no one should carry alone.",
    color: UNITY_RED,
    tint: "#fdf2f1",
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
  { n: "01", title: "Describe", color: "#b45309", body: "Tell us what you sell and where you're based, in your own words. No HS codes, no trade jargon." },
  {
    n: "02",
    title: "Compare",
    color: "#2a78d6",
    body: "See every market ranked by how easy it is to enter and how much it buys. Tune what matters to you and watch the ranking move.",
  },
  {
    n: "03",
    title: "Act",
    color: UNITY_RED,
    body: "Take away drafted paperwork, a first message to a real importer, and other Canadian producers to ship with.",
  },
];

const SOURCES = ["U.S. CBP", "CFIA", "Japan Customs", "EU law", "Trade agreement texts"];

function Home({ categories, description, setDescription, onAnalyze, onPickCategory, loading, error, unsupported, inputRef, go, onStart }) {
  const canSubmit = description.trim().length >= 10 && !loading;
  return (
    <main>
      {/* ---------- hero ---------- */}
      <section className="relative overflow-hidden">
        <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-10 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_0.9fr] lg:pb-28">
          <div>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-200/80 bg-white/70 py-1 pl-1.5 pr-3 text-xs font-medium text-amber-900 shadow-sm backdrop-blur">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-800">New</span>
              Built for Canadian exporters
            </p>
            <h1 className="text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
              Find your next{" "}
              <span className="font-display text-sheen whitespace-nowrap pr-2 text-[1.12em] font-normal italic tracking-[-0.01em]">market.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600">
              Describe what you sell. Portage ranks every market by how much it buys and how hard it is to enter, then drafts the paperwork and your
              first message to a real importer.
            </p>

            <form
              id="start"
              className="mt-9 scroll-mt-28"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSubmit) onAnalyze();
              }}
            >
              <div className="rounded-[1.35rem] border border-neutral-200/80 bg-white/90 p-2 shadow-[0_18px_50px_-20px_rgba(120,53,15,0.35)] backdrop-blur transition-all focus-within:border-amber-300 focus-within:ring-4 focus-within:ring-amber-100">
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
                        className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs text-neutral-600 transition-all hover:-translate-y-px hover:border-neutral-300 hover:text-neutral-900 hover:shadow-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: ex.color }} aria-hidden />
                        {ex.label}
                      </button>
                    ))}
                  </div>
                  <Button type="submit" size="lg" disabled={!canSubmit} className="group rounded-xl">
                    {loading ? (
                      <>
                        <Spinner /> Analyzing
                      </>
                    ) : (
                      <>
                        Find my markets
                        <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
                      <button
                        type="button"
                        onClick={() => onPickCategory(c)}
                        className="font-medium text-neutral-800 underline decoration-amber-400/70 decoration-2 underline-offset-4 transition-colors hover:decoration-amber-600"
                      >
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

          <RouteCard />
        </div>
      </section>

      {/* ---------- sources strip ---------- */}
      <section className="border-y border-neutral-200/70 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-4 py-5 sm:px-6">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-neutral-400">Every number links to its source</span>
          {SOURCES.map((s) => (
            <span key={s} className="text-sm font-semibold tracking-tight text-neutral-400">
              {s}
            </span>
          ))}
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            From <span className="font-display font-normal italic tracking-normal text-accent">“where should I sell?”</span> to your first shipment.
          </h2>
        </div>
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.n} className="lift relative rounded-3xl border border-neutral-200/80 bg-white p-7">
              <span className="font-display text-6xl italic leading-none" style={{ color: s.color }}>
                {s.n}
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{s.body}</p>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-4 top-1/2 z-10 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-neutral-200 bg-paper text-neutral-400 md:grid" aria-hidden>
                  <Arrow className="h-3.5 w-3.5" />
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      {/* ---------- features ---------- */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <Eyebrow>What you get</Eyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Everything, in <span className="font-display font-normal italic tracking-normal">one sitting.</span>
            </h2>
          </div>
          <p className="max-w-sm text-neutral-500">The research a trade consultant would take weeks on, laid out in plain language you can act on tonight.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="lift group rounded-3xl border p-7"
              style={{ borderColor: `${f.color}33`, background: `linear-gradient(140deg, #fff 35%, ${f.tint})` }}
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-sm ring-1" style={{ "--tw-ring-color": `${f.color}33` }}>
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke={f.color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {f.icon}
                </svg>
              </span>
              <h3 className="mt-5 text-xl font-semibold tracking-tight">{f.title}</h3>
              <p className="mt-2 leading-relaxed text-neutral-600">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- mission band ---------- */}
      <section className="px-4 pb-24 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-neutral-950 px-6 py-16 text-white sm:px-14 sm:py-20">
          <div className="band-glow pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative max-w-3xl">
            <Eyebrow className="text-amber-300">Our mission</Eyebrow>
            <p className="mt-5 font-display text-3xl leading-[1.15] sm:text-5xl">
              The information to export already exists. It's spread across twenty websites and written for <em className="text-amber-300">experts.</em>
            </p>
            <p className="mt-6 max-w-xl text-lg text-neutral-400">Portage turns it into a plan a small business can act on tonight, and connects it with every other Canadian business going the same way.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => go("mission")}
                className="group inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-neutral-900 transition-all hover:bg-amber-50 active:scale-[0.98]"
              >
                Read our mission <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                type="button"
                onClick={onStart}
                className="inline-flex h-11 items-center rounded-xl border border-white/15 px-5 text-[15px] font-medium text-white/90 transition-colors hover:bg-white/10"
              >
                Try it now
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

/* ---------------- hero visual: routes out of Canada ---------------- */

const DESTS = [
  { code: "US", y: 34 },
  { code: "GB", y: 76 },
  { code: "DE", y: 118 },
  { code: "JP", y: 160 },
  { code: "KR", y: 202 },
  { code: "CN", y: 244 },
  { code: "AU", y: 286 },
  { code: "MX", y: 328 },
];
const FACTORS = [
  ["Tariffs", "#2a78d6"],
  ["Compliance", "#eb6834"],
  ["Logistics", "#1baf7a"],
  ["Risk", "#8a5cd6"],
  ["Tax", "#eda100"],
];

function RouteCard() {
  return (
    <div className="float-slow relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div className="absolute -inset-4 rounded-[2.2rem] bg-gradient-to-br from-amber-200/40 via-rose-200/30 to-sky-200/40 blur-2xl" />
      <div className="relative rounded-[1.75rem] border border-white/70 bg-white/80 p-5 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-neutral-400">Canada → 8 markets</span>
          <span className="flex gap-1">
            {["#f87171", "#fbbf24", "#34d399"].map((c) => (
              <span key={c} className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />
            ))}
          </span>
        </div>
        <svg viewBox="0 0 400 362" className="mt-3 w-full">
          <defs>
            <linearGradient id="route" x1="0" x2="1">
              <stop offset="0" stopColor={UNITY_RED} />
              <stop offset="1" stopColor="#b45309" />
            </linearGradient>
          </defs>
          {DESTS.map((d, i) => (
            <path
              key={d.code}
              d={`M62 181 C 170 181, 210 ${d.y}, 318 ${d.y}`}
              fill="none"
              stroke="url(#route)"
              strokeWidth="1.6"
              className="flow"
              style={{ animationDelay: `${i * -0.2}s` }}
            />
          ))}
          <circle cx="62" cy="181" r="30" fill={UNITY_RED} opacity=".08" className="pulse-ring" />
          <circle cx="62" cy="181" r="22" fill="#fff" stroke={UNITY_RED} strokeWidth="1.5" />
          <text x="62" y="185.5" textAnchor="middle" fontSize="13" fontWeight="700" fill={UNITY_RED} fontFamily="Inter, sans-serif">
            CA
          </text>
          {DESTS.map((d, i) => (
            <g key={d.code} className="node-pop" style={{ animationDelay: `${0.2 + i * 0.07}s` }}>
              <rect x="320" y={d.y - 13} width="46" height="26" rx="8" fill="#fff" stroke="#e5e5e5" />
              <text x="343" y={d.y + 4.5} textAnchor="middle" fontSize="12" fontWeight="600" fill="#262626" fontFamily="'JetBrains Mono', monospace">
                {d.code}
              </text>
            </g>
          ))}
        </svg>
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-4">
          {FACTORS.map(([label, c]) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-50 px-2.5 py-1 text-[11px] font-medium text-neutral-600 ring-1 ring-neutral-200/70">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- footer ---------------- */

function SiteFooter({ go, onHow, onStart }) {
  const col = (title, items) => (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-400">{title}</p>
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
    <footer className="border-t border-neutral-200/70 bg-white/50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs font-display text-xl italic leading-snug text-neutral-700">Growing Canada, one small business at a time, and together.</p>
        </div>
        {col("Product", [
          ["How it works", onHow],
          ["Get started", onStart],
        ])}
        {col("Company", [
          ["Our mission", () => go("mission")],
          ["About us", () => go("about")],
          ["FAQ", () => go("faq")],
        ])}
      </div>
      <div className="border-t border-neutral-200/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-5 text-xs text-neutral-400 sm:px-6">
          <span>© 2026 Portage · Built at AF Hacks: Growing Canada, Waterloo</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: UNITY_RED }} /> Made in Canada · Every figure links to its source
          </span>
        </div>
      </div>
    </footer>
  );
}
