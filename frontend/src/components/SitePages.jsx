import { useState } from "react";
import { UNITY_RED } from "../lib/together.js";
import { Arrow, Eyebrow } from "./Brand.jsx";

/* Shared layout for the marketing pages (Mission, About us, FAQ). */
function PageHero({ eyebrow, title, lead }) {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-14 sm:px-6 sm:pt-24">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-[2.6rem] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-6xl">{title}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 sm:text-xl">{lead}</p>
      </div>
    </section>
  );
}

const Serif = ({ children, className = "" }) => (
  <span className={`font-display text-[1.08em] font-normal italic tracking-[-0.01em] ${className}`}>{children}</span>
);

function SectionTitle({ eyebrow, children }) {
  return (
    <div className="max-w-2xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">{children}</h2>
    </div>
  );
}

function CtaBand({ onStart, title = "See where your business could go." }) {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 overflow-hidden rounded-[2rem] bg-neutral-950 px-6 py-12 text-white sm:px-12">
        <div className="band-glow pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative max-w-xl font-display text-3xl leading-tight sm:text-4xl">{title}</p>
        <button
          type="button"
          onClick={onStart}
          className="group relative inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-neutral-900 transition-all hover:bg-amber-50 active:scale-[0.98]"
        >
          Find my markets <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Mission */

const STATS = [
  { value: "66%", body: "of exporting small businesses name shipping costs as a top barrier.", color: "#1baf7a" },
  { value: "⅓ to ¾", body: "of trading small businesses don't know the government's export help exists, depending on the program.", color: "#2a78d6" },
  { value: "$300k", body: "in revenue, plus three employees, is now the minimum to qualify for a CanExport grant.", color: "#eb6834" },
];

const BELIEFS = [
  {
    title: "Sourced, never guessed",
    color: "#2a78d6",
    body: "Every tariff and requirement links to the official source, with the date we checked it. The AI reads your description and drafts your messages. It never decides the facts.",
  },
  {
    title: "A finished job, not advice",
    color: "#eb6834",
    body: "Portage doesn't stop at a ranking. It ends with your paperwork drafted, a real importer to contact, and a message ready to send.",
  },
  {
    title: "Canada is stronger together",
    color: UNITY_RED,
    body: "A chatbot talks to one business. Portage connects many: producers heading to the same market can fill a container, share a broker and meet an importer's minimum order together.",
  },
];

const NEXT = [
  ["Alerts that come to you", "When a tariff or rule changes for your product and your markets, Portage tells you first."],
  ["A front door to the help that exists", "The Trade Commissioner Service and CanExport already help exporters. Portage sends small firms in ready: best market, paperwork, and who to call."],
  ["Partners who already have the exporters", "Industry associations and trade offices can hand Portage to their members. Every exporter who joins makes the next shipment cheaper for everyone."],
];

export function MissionPage({ onStart }) {
  return (
    <main>
      <PageHero
        eyebrow="Our mission"
        title={
          <>
            Help every Canadian small business <Serif className="text-sheen pr-1">reach the world.</Serif>
          </>
        }
        lead="Canada already has the trade agreements, the trade commissioners and the grants. What most small businesses are missing is a way in. Portage is that front door."
      />

      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <SectionTitle eyebrow="The problem">
          Exporting is <Serif>possible.</Serif> It just isn't easy.
        </SectionTitle>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="lift rounded-3xl border border-neutral-200/80 bg-white p-7">
              <p className="font-display text-6xl leading-none" style={{ color: s.color }}>
                {s.value}
              </p>
              <p className="mt-4 leading-relaxed text-neutral-600">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-400">Sources: Canadian Federation of Independent Business (2024); CanExport SMEs program criteria.</p>
      </section>

      <section className="border-y border-neutral-200/70 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionTitle eyebrow="What we believe">Three promises.</SectionTitle>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {BELIEFS.map((b, i) => (
              <div key={b.title} className="lift rounded-3xl border p-7" style={{ borderColor: `${b.color}33`, background: `linear-gradient(150deg, #fff 40%, ${b.color}0f)` }}>
                <span className="font-mono text-xs font-medium" style={{ color: b.color }}>
                  0{i + 1}
                </span>
                <h3 className="mt-3 text-xl font-semibold tracking-tight">{b.title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{b.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionTitle eyebrow="Where we're going">
          Growing Canada, <Serif>together.</Serif>
        </SectionTitle>
        <ol className="mt-10 divide-y divide-neutral-200/80 border-y border-neutral-200/80">
          {NEXT.map(([t, b], i) => (
            <li key={t} className="grid gap-2 py-7 sm:grid-cols-[4rem_1fr_1.4fr] sm:gap-6">
              <span className="font-display text-3xl italic text-accent">{i + 1}.</span>
              <h3 className="text-lg font-semibold tracking-tight">{t}</h3>
              <p className="leading-relaxed text-neutral-600">{b}</p>
            </li>
          ))}
        </ol>
      </section>

      <CtaBand onStart={onStart} />
    </main>
  );
}

/* ---------------------------------------------------------------- About */

const PILLARS = [
  {
    title: "The data",
    color: "#2a78d6",
    body: "Tariffs, certificates and customs rules from official sources like U.S. CBP, the CFIA, Japan Customs and EU law, each shown with a link and the date it was checked.",
  },
  {
    title: "The score",
    color: "#1baf7a",
    body: "A formula, not a black box. Each market's ease comes from tariffs, compliance, logistics, risk and tax. You can change how much each one counts and see every input.",
  },
  {
    title: "The AI",
    color: "#8a5cd6",
    body: "It does two jobs: turning your description into a profile, and drafting your outreach, including a voice note in the buyer's language. Rankings and paperwork come from the sourced data.",
  },
];

export function AboutPage({ onStart, go }) {
  return (
    <main>
      <PageHero
        eyebrow="About us"
        title={
          <>
            Named for the oldest <Serif className="text-sheen pr-1">Canadian shortcut.</Serif>
          </>
        }
        lead="A portage is where you lift the canoe out of the water and carry it overland to the next river. Voyageurs used them to cross a continent. We built Portage to carry small businesses over the hard stretch between one market and the next."
      />

      <section className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <SectionTitle eyebrow="Our story">
            Built in a <Serif>weekend,</Serif> for the long haul.
          </SectionTitle>
        </div>
        <div className="space-y-5 text-lg leading-relaxed text-neutral-600">
          <p>
            Portage started at <span className="font-medium text-neutral-900">AF Hacks: Growing Canada 2026</span> in Waterloo, Ontario. We wanted exporting to feel as doable for a
            family beekeeper in Falher, Alberta as it is for a company with a trade department.
          </p>
          <p>
            While building it we found a news story saying maple syrup had been hit by a new U.S. tariff. The official list said it hadn't. That's why every number in Portage
            comes from the source, with a link and a date, and why the same business always gets the same answer.
          </p>
          <button type="button" onClick={() => go("mission")} className="group inline-flex items-center gap-1.5 text-base font-medium text-accent">
            Read our mission <Arrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <section className="border-y border-neutral-200/70 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionTitle eyebrow="Under the hood">
            Transparent by <Serif>design.</Serif>
          </SectionTitle>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PILLARS.map((p) => (
              <div key={p.title} className="lift rounded-3xl border border-neutral-200/80 bg-white p-7">
                <span className="block h-1 w-10 rounded-full" style={{ background: p.color }} />
                <h3 className="mt-5 text-xl font-semibold tracking-tight">{p.title}</h3>
                <p className="mt-2 leading-relaxed text-neutral-600">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionTitle eyebrow="Who it's for">
          Small businesses with <Serif>big plans.</Serif>
        </SectionTitle>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <div className="lift rounded-3xl border p-7" style={{ borderColor: "#eda10033", background: "linear-gradient(150deg,#fff 40%,#fdf6e3)" }}>
            <h3 className="text-xl font-semibold tracking-tight">Producers</h3>
            <p className="mt-2 leading-relaxed text-neutral-600">
              Food and goods makers looking past a single market. Portage finds where your product is wanted, what each border asks for, and who else is shipping there.
            </p>
          </div>
          <div className="lift rounded-3xl border p-7" style={{ borderColor: "#2a78d633", background: "linear-gradient(150deg,#fff 40%,#eef4fc)" }}>
            <h3 className="text-xl font-semibold tracking-tight">Software companies</h3>
            <p className="mt-2 leading-relaxed text-neutral-600">
              For SaaS, the border is data rules, not tariffs. Portage ranks markets on privacy and data-transfer rules, tax and risk, and drafts the agreements your customers will ask for.
            </p>
          </div>
        </div>
      </section>

      <CtaBand onStart={onStart} title="Carry your business to its next market." />
    </main>
  );
}

/* ---------------------------------------------------------------- FAQ */

const FAQS = [
  {
    q: "Why not just ask a chatbot?",
    a: "You can, and you may get a confident answer that's wrong. Tariffs can change several times in a month, often after a model was trained. Portage's numbers come from the official source with a link and a date, the same inputs always give the same ranking, and the importers it suggests are real.",
  },
  {
    q: "Where does the data come from?",
    a: "Official sources: customs agencies such as U.S. CBP and Japan Customs, the CFIA, EU law and the text of Canada's trade agreements. Each figure in the app links to where it came from.",
  },
  {
    q: "How is a market's score worked out?",
    a: "Each market gets an ease score out of 100 built from five factors: tariffs, compliance, logistics, risk and tax. For goods, Portage also sizes the opportunity from how much the market imports. Use Tune to change how much each factor counts; the market panel shows every input.",
  },
  {
    q: "Does Portage ship my goods?",
    a: "No. Portage is the matchmaker. It finds other Canadian producers heading to the same market and brings the group to certified freight forwarders, who quote, ship and clear customs. Each business still needs its own export certificate.",
  },
  {
    q: "Does it replace the Trade Commissioner Service?",
    a: "No, it sends you there ready. The Trade Commissioner Service and CanExport already help exporters, but many small firms don't know they exist. Portage points you to the right contact once you know your market.",
  },
  {
    q: "Which products can I use it for?",
    a: "Verified data today covers natural honey and B2B software that handles personal data. Every requirement shows how confident we are in it, so you always know what's been checked.",
  },
  {
    q: "Is anything sent without me?",
    a: "No. Emails, voice notes and freight quote requests are drafts. Nothing goes to an importer or a forwarder until you send it yourself.",
  },
];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className={`rounded-2xl border transition-colors ${open ? "border-amber-200 bg-white shadow-sm" : "border-neutral-200/80 bg-white/60 hover:bg-white"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="text-[17px] font-semibold tracking-tight">{q}</span>
        <span
          className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border transition-all duration-300 ${open ? "rotate-45 border-amber-300 bg-amber-50 text-accent" : "border-neutral-200 text-neutral-500"}`}
          aria-hidden
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M10 4v12M4 10h12" />
          </svg>
        </span>
      </button>
      <div className="expand" data-open={open}>
        <div>
          <p className="px-6 pb-6 leading-relaxed text-neutral-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqPage({ onStart }) {
  const [open, setOpen] = useState(0);
  return (
    <main>
      <PageHero
        eyebrow="FAQ"
        title={
          <>
            Questions, <Serif className="text-sheen pr-1">answered.</Serif>
          </>
        }
        lead="What Portage does, where its numbers come from, and what it doesn't do."
      />
      <section className="mx-auto max-w-3xl space-y-3 px-4 pb-24 sm:px-6">
        {FAQS.map((f, i) => (
          <FaqItem key={f.q} {...f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
        ))}
      </section>
      <CtaBand onStart={onStart} title="Still curious? Try it on your own business." />
    </main>
  );
}
