import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { LANGUAGE_NAMES, hostname } from "../lib/format.js";
import { Button, ErrorNote, ExternalLink, Spinner, useReveal } from "./ui.jsx";

export function OutreachPanel({ profile, market }) {
  const [partner, setPartner] = useState(null);
  const [stage, setStage] = useState("pick"); // pick | drafting | edit | voicing | done
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [voice, setVoice] = useState(null);
  const [error, setError] = useState(null);
  const [draftTick, setDraftTick] = useState(0); // bumps when a draft arrives, to bring it into view
  const [draftRef, subjectRef] = useReveal(draftTick);
  const [voiceRef, audioRef] = useReveal(voice);
  const lang = market.entry.language;
  const langName = LANGUAGE_NAMES[lang] ?? lang;

  useEffect(() => {
    setPartner(null);
    setStage("pick");
    setVoice(null);
    setError(null);
  }, [market.country_code]);

  async function draft(m) {
    setPartner(m);
    setStage("drafting");
    setError(null);
    setVoice(null);
    try {
      const d = await api.outreach(profile, market.country_code, m.id);
      setSubject(d.subject);
      setBody(d.body);
      setStage("edit");
      setDraftTick((t) => t + 1);
    } catch (e) {
      setError(e.message);
      setStage("pick");
    }
  }

  async function makeVoice() {
    setStage("voicing");
    setError(null);
    try {
      setVoice(await api.voice(body, lang));
      setStage("done");
    } catch (e) {
      setError(e.message);
      setStage("edit");
    }
  }

  const busy = stage === "drafting" || stage === "voicing";

  return (
    <div className="space-y-5">
      <p className="text-sm text-neutral-500">
        Being legally cleared isn't the same as having a way in. These are real, verified companies and contacts for{" "}
        {market.entry.country}.
      </p>

      {market.middlemen.length === 0 ? (
        <p className="text-sm text-neutral-500">No partners on file for this market yet.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {market.middlemen.map((m) => (
            <li
              key={m.id}
              className={`flex flex-col rounded-lg border p-4 transition-all ${
                partner?.id === m.id ? "border-brand/60 bg-brand-50/50 ring-2 ring-brand/15" : "border-neutral-200"
              }`}
            >
              <span className="text-sm font-medium">{m.name}</span>
              <span className="text-xs text-neutral-500">{m.type}</span>
              <p className="mt-2 flex-1 text-sm text-neutral-600">{m.description}</p>
              <div className="mt-3 flex items-center justify-between gap-2">
                <ExternalLink href={m.website} className="truncate text-xs text-neutral-400">
                  {hostname(m.website)}
                </ExternalLink>
                <Button size="sm" variant={partner?.id === m.id ? "primary" : "outline"} disabled={busy} onClick={() => draft(m)}>
                  {stage === "drafting" && partner?.id === m.id ? (
                    <>
                      <Spinner /> Drafting…
                    </>
                  ) : (
                    "Draft outreach"
                  )}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ErrorNote>{error}</ErrorNote>

      {(stage === "edit" || stage === "voicing" || stage === "done") && partner && (
        <div ref={draftRef} className="fade-up scroll-mt-6 rounded-lg border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-medium">Your message to {partner.name}</h3>
            <span className="text-xs text-neutral-400">Edit freely. Nothing is sent.</span>
          </div>
          <label className="sr-only" htmlFor="outreach-subject">
            Subject
          </label>
          <input
            ref={subjectRef}
            id="outreach-subject"
            value={subject}
            onChange={(ev) => setSubject(ev.target.value)}
            className="mt-3 w-full rounded-md border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-neutral-400"
          />
          <label className="sr-only" htmlFor="outreach-body">
            Message
          </label>
          <textarea
            id="outreach-body"
            value={body}
            rows={10}
            onChange={(ev) => {
              setBody(ev.target.value);
              if (stage === "done") setStage("edit");
            }}
            className="mt-2 w-full resize-y rounded-md border border-neutral-200 px-3 py-2 text-sm leading-relaxed outline-none focus:border-neutral-400"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <Button variant="outline" size="sm" onClick={() => navigator.clipboard?.writeText(`${subject}\n\n${body}`)}>
              Copy email
            </Button>
            <Button size="sm" onClick={makeVoice} disabled={stage === "voicing" || body.trim().length === 0}>
              {stage === "voicing" ? (
                <>
                  <Spinner /> Creating voice note
                </>
              ) : (
                `Approve & create ${langName} voice note`
              )}
            </Button>
          </div>
        </div>
      )}

      {stage === "done" && voice && (
        <div ref={voiceRef} className="fade-up scroll-mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <h3 className="text-sm font-medium">Voice note in {LANGUAGE_NAMES[voice.language] ?? voice.language}</h3>
          <p className="mt-1 text-xs text-neutral-500">
            An icebreaker to attach to your email. It helps a cold message get a second look; the deal still runs on your
            product, samples and pricing.
          </p>
          <audio ref={audioRef} controls className="mt-3 w-full" src={`data:audio/mpeg;base64,${voice.audio_base64}`} />
          <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{voice.script}</p>
          <a
            download={`voice-note-${market.country_code}.mp3`}
            href={`data:audio/mpeg;base64,${voice.audio_base64}`}
            className="mt-2 inline-block text-xs text-neutral-500 underline"
          >
            Download MP3
          </a>
        </div>
      )}
    </div>
  );
}
