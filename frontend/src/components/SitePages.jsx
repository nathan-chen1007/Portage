import { useState } from "react";
import { UNITY_RED } from "../lib/together.js";
import { Arrow, Eyebrow } from "./Brand.jsx";

/* Shared layout for the marketing pages (Mission, About us, FAQ). */
function PageHero({ eyebrow, title, lead }) {
  return (
    <section className="relative overflow-hidden border-b border-neutral-200">
      <div className="grid-bg pointer-events-none absolute inset-0" aria-hidden />
      <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-16 sm:px-6 sm:pt-20">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-3 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-neutral-600">{lead}</p>
      </div>
    </section>
  );
}

function Section({ eyebrow, title, children, muted = false }) {
  return (
    <section className={muted ? "border-y border-neutral-200 bg-neutral-50" : ""}>
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="max-w-2xl">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
        </div>
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Card({ title, color, children }) {
  return (
    <div className="card-hover rounded-2xl border bg-white p-6" style={{ borderColor: color ? `${color}40` : "#e5e5e5" }}>
      {color && <span className="block h-1 w-8 rounded-full" style={{ background: color }} />}
      <h3 className={`${color ? "mt-4" : ""} text-lg font-semibold tracking-tight`}>{title}</h3>
      <p className="mt-2 leading-relaxed text-neutral-600">{children}</p>
    </div>
  );
}

function CtaBand({ onStart, title = "See which markets fit your business." }) {
  return (
    <section className="px-4 pb-24 pt-4 sm:px-6">
      <div className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-neutral-950 px-6 py-12 text-white sm:px-12">
        <div className="band-glow pointer-events-none absolute inset-0" aria-hidden />
        <p className="relative max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">{title}</p>
        <button
          type="button"
          onClick={onStart}
          className="relative inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-200"
        >
          Find my markets <Arrow className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Mission */

const STATS = [
  { value: "66%", body: "of exporting small businesses name shipping costs as a top barrier." },
  { value: "⅓ to ¾", body: "of trading small businesses don't know about government export programs, depending on the program." },
  { value: "$300k", body: "in annual revenue, plus three employees, is the minimum to qualify for a CanExport grant." },
];

export function MissionPage({ onStart }) {
  return (
    <main>
      <PageHero
        eyebrow="Our mission"
        title="Make exporting practical for every Canadian small business."
        lead="Canada has trade agreements, trade commissioners and export grants. Small businesses often don't know where to start. Portage gives them a clear first step: which market to enter, what paperwork it needs, and who to contact."
      />

      <Section eyebrow="The problem" title="The barriers are cost and complexity, not interest.">
        <div className="grid gap-5 md:grid-cols-3">
          {STATS.map((s) => (
            <div key={s.value} className="rounded-2xl border border-neutral-200 bg-white p-6">
              <p className="text-4xl font-semibold tracking-tight">{s.value}</p>
              <p className="mt-3 leading-relaxed text-neutral-600">{s.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-neutral-500">Sources: Canadian Federation of Independent Business (2024); CanExport SMEs eligibility criteria.</p>
      </Section>

      <Section muted eyebrow="Our approach" title="How Portage addresses it.">
        <div className="grid gap-5 md:grid-cols-3">
          <Card title="Sourced data" color="#2a78d6">
            Tariffs and requirements come from official sources and link back to them, with the date they were checked. AI is only used to read your description and draft
            messages.
          </Card>
          <Card title="Complete next steps" color="#eb6834">
            Each market comes with drafted paperwork and importers to contact, not just a score.
          </Card>
          <Card title="Businesses working together" color={UNITY_RED}>
            Portage groups exporters heading to the same market so they can share shipping costs and meet larger orders.
          </Card>
        </div>
      </Section>

      <Section eyebrow="What's next" title="Where Portage is going.">
        <div className="grid gap-5 md:grid-cols-3">
          <Card title="Change alerts">Notify businesses when a tariff or rule changes for their product and markets.</Card>
          <Card title="Government programs">Point each business to the Trade Commissioner Service contact and export programs that apply to them.</Card>
          <Card title="Industry partners">Offer Portage through industry associations, so each new member makes shared shipping cheaper for everyone.</Card>
        </div>
      </Section>

      <CtaBand onStart={onStart} />
    </main>
  );
}

/* ---------------------------------------------------------------- About */

export function AboutPage({ onStart }) {
  return (
    <main>
      <PageHero
        eyebrow="About us"
        title="About Portage"
        lead="Portage is an export planning tool for Canadian small businesses. It ranks international markets, drafts the paperwork each one requires, and connects businesses heading to the same market."
      />

      <Section eyebrow="How it works" title="What's behind the results.">
        <div className="grid gap-5 md:grid-cols-3">
          <Card title="Data" color="#2a78d6">
            Tariffs, certificates and customs rules from official sources such as U.S. CBP, the CFIA, Japan Customs and EU law. Each figure shows its source and the date it
            was checked.
          </Card>
          <Card title="Scoring" color="#1baf7a">
            Each market's ease of entry is calculated from tariffs, compliance, logistics, risk and tax. You can change how much each factor counts, and every input is shown.
          </Card>
          <Card title="AI" color="#8a5cd6">
            Used for two tasks: turning your description into a business profile, and drafting outreach emails and voice notes. Rankings and paperwork come from the data.
          </Card>
        </div>
      </Section>

      <Section muted eyebrow="Who it's for" title="Goods producers and software companies.">
        <div className="grid gap-5 md:grid-cols-2">
          <Card title="Goods producers" color="#eda100">
            Compare markets on tariffs, certificates and shipping, find importers, and join other producers to share a shipment.
          </Card>
          <Card title="Software companies" color="#2a78d6">
            Compare markets on privacy and data-transfer rules, tax and risk, and get drafts of the data agreements customers ask for.
          </Card>
        </div>
      </Section>

      <Section eyebrow="Background" title="Built at AF Hacks: Growing Canada 2026.">
        <p className="max-w-2xl text-lg leading-relaxed text-neutral-600">
          Portage was built in Waterloo, Ontario, during AF Hacks: Growing Canada. The name comes from the overland route used to carry a canoe between two waterways.
        </p>
      </Section>

      <CtaBand onStart={onStart} />
    </main>
  );
}

/* ---------------------------------------------------------------- FAQ */

const FAQS = [
  {
    q: "How is this different from asking a chatbot?",
    a: "A general chatbot can give outdated or incorrect tariff information, and its answer changes each time you ask. Portage uses official sources, shows a link and date for each figure, gives the same ranking for the same inputs, and suggests real importers.",
  },
  {
    q: "Where does the data come from?",
    a: "Official sources: customs agencies such as U.S. CBP and Japan Customs, the CFIA, EU law and the text of Canada's trade agreements. Each figure in the app links to its source.",
  },
  {
    q: "How is a market's score calculated?",
    a: "Each market gets an ease score out of 100 from five factors: tariffs, compliance, logistics, risk and tax. For goods, Portage also measures market size from import data. Use Tune to change how much each factor counts. The market panel shows every input.",
  },
  {
    q: "Does Portage ship my goods?",
    a: "No. Portage groups businesses heading to the same market and requests quotes from certified freight forwarders, who handle shipping and customs. Each business still needs its own export certificate.",
  },
  {
    q: "Does it replace the Trade Commissioner Service?",
    a: "No. The Trade Commissioner Service and CanExport help exporters directly. Portage helps you decide on a market first, then points you to the right contact.",
  },
  {
    q: "Which products are supported?",
    a: "Verified data currently covers natural honey and B2B software that handles personal data. Each requirement shows a confidence level so you know what has been checked.",
  },
  {
    q: "Is anything sent without my approval?",
    a: "No. Emails, voice notes and freight quote requests are drafts. Nothing is sent to an importer or forwarder until you send it.",
  },
];

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className={`rounded-xl border bg-white transition-colors ${open ? "border-neutral-300" : "border-neutral-200 hover:border-neutral-300"}`}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left">
        <span className="font-semibold">{q}</span>
        <svg
          viewBox="0 0 20 20"
          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 8l5 5 5-5" />
        </svg>
      </button>
      <div className="expand" data-open={open}>
        <div>
          <p className="px-5 pb-5 leading-relaxed text-neutral-600">{a}</p>
        </div>
      </div>
    </div>
  );
}

export function FaqPage({ onStart }) {
  const [open, setOpen] = useState(0);
  return (
    <main>
      <PageHero eyebrow="FAQ" title="Frequently asked questions" lead="What Portage does, where its data comes from, and what it doesn't do." />
      <section className="mx-auto max-w-3xl space-y-3 px-4 py-16 sm:px-6">
        {FAQS.map((f, i) => (
          <FaqItem key={f.q} {...f} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
        ))}
      </section>
      <CtaBand onStart={onStart} />
    </main>
  );
}
