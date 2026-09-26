import { useEffect, useRef, useState } from "react";

// Each step shows for its own duration so the run feels like real work. The backend call runs in parallel;
// the last step holds until the data is in, then the bar completes and onFinished fires.
export const STEPS = [
  { label: "Reading your description", ms: 650 },
  { label: "Classifying your product", ms: 600 },
  { label: "Checking tariffs in every market", ms: 700 },
  { label: "Matching trade agreements", ms: 500 },
  { label: "Mapping compliance requirements", ms: 750 },
  { label: "Measuring shipping lanes and customs", ms: 600 },
  { label: "Assessing currency and country risk", ms: 500 },
  { label: "Sizing each market's opportunity", ms: 600 },
  { label: "Finding Canadian exporters heading your way", ms: 650 },
  { label: "Ranking your markets", ms: 550 },
];

const FAST = import.meta.env?.MODE === "test";
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Full-screen progress sequence shown while markets are being found. */
export function LoadingScreen({ subject, ready, onFinished }) {
  const [step, setStep] = useState(0); // index of the step in progress
  const [complete, setComplete] = useState(false);
  const finished = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const scale = FAST ? 0 : reducedMotion() ? 0.35 : 1;

  // Advance through the steps; the last one waits for the data.
  useEffect(() => {
    if (step >= STEPS.length - 1) return undefined;
    const t = setTimeout(() => setStep((s) => s + 1), STEPS[step].ms * scale);
    return () => clearTimeout(t);
  }, [step, scale]);

  useEffect(() => {
    if (!ready || step < STEPS.length - 1 || finished.current) return undefined;
    const t1 = setTimeout(() => setComplete(true), STEPS[step].ms * scale);
    const t2 = setTimeout(() => {
      finished.current = true;
      onFinishedRef.current();
    }, (STEPS[step].ms + 650) * scale);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, step, scale]);

  const pctDone = complete ? 100 : Math.min(96, Math.round(((step + 0.5) / STEPS.length) * 100));

  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-white/95 px-4 backdrop-blur-sm ${complete ? "loader-out" : "fade-in"}`} role="status" aria-live="polite">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="loader-mark relative mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-neutral-900 shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
              <path d="M7 21c3-7 6-10 9-10s6 3 9 10" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" className="loader-arc" />
              <circle cx="16" cy="11" r="2.4" fill="#f59e0b" className="loader-dot" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold tracking-tight">{complete ? "Your markets are ready" : "Finding your markets"}</h2>
          {subject && <p className="mt-1 line-clamp-1 max-w-sm text-sm text-neutral-500">{subject}</p>}
        </div>

        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span className="font-medium text-neutral-700">{complete ? "Done" : `${STEPS[step].label}…`}</span>
          <span className="tabular-nums">{pctDone}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pctDone} aria-valuemin={0} aria-valuemax={100}>
          <div className="loader-bar h-full rounded-full bg-neutral-900" style={{ width: `${pctDone}%` }} />
        </div>

        <ol className="mt-6 space-y-2">
          {STEPS.map((s, i) => {
            const state = complete || i < step ? "done" : i === step ? "active" : "todo";
            return (
              <li
                key={s.label}
                className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                  state === "todo" ? "text-neutral-300" : state === "active" ? "text-neutral-900" : "text-neutral-500"
                }`}
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center">
                  {state === "done" ? (
                    <svg viewBox="0 0 20 20" className="tick h-5 w-5" aria-hidden>
                      <circle cx="10" cy="10" r="9" fill="#171717" />
                      <path d="M6 10.5l2.5 2.5L14 7.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : state === "active" ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-900 border-r-transparent" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-neutral-200" />
                  )}
                </span>
                <span className={state === "active" ? "font-medium" : ""}>{s.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
