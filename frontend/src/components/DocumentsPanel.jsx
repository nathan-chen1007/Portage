import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { hostname } from "../lib/format.js";
import { Button, ErrorNote, ExternalLink, Skeleton } from "./ui.jsx";

export function DocumentsPanel({ profile, countryCode }) {
  const [docs, setDocs] = useState(null);
  const [open, setOpen] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    let alive = true;
    setDocs(null);
    setError(null);
    api
      .documents(profile, countryCode)
      .then((d) => {
        if (!alive) return;
        setDocs(d);
        setOpen(d[0]?.id ?? null);
      })
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [profile, countryCode]);

  async function copy(doc) {
    try {
      await navigator.clipboard.writeText(doc.body);
      setCopied(doc.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked; ignore */
    }
  }

  if (error) return <ErrorNote>{error}</ErrorNote>;
  if (!docs) return <Skeleton className="h-40 w-full" />;
  if (docs.length === 0) return <p className="text-sm text-neutral-500">No paperwork templates for this market yet.</p>;

  return (
    <div className="space-y-3">
      <p className="text-sm text-neutral-500">
        Filled from what you told us, using the official template wording. Blanks marked [___] are yours to complete.
      </p>
      {docs.map((d) => (
        <div key={d.id} className="rounded-lg border border-neutral-200">
          <button
            type="button"
            onClick={() => setOpen(open === d.id ? null : d.id)}
            className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-sm font-medium">{d.title}</span>
              <span className="block text-sm text-neutral-500">{d.purpose}</span>
            </span>
            <span className="shrink-0 text-xs text-neutral-400">
              {d.missing_fields.length > 0 ? `${d.missing_fields.length} to fill` : "Ready"}
            </span>
          </button>
          {open === d.id && (
            <div className="border-t border-neutral-100 px-4 py-3">
              {d.missing_fields.length > 0 && (
                <p className="mb-2 text-xs text-neutral-500">Still needed: {d.missing_fields.join(" · ")}</p>
              )}
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-50 p-3 font-mono text-xs leading-relaxed text-neutral-800">
                {d.body}
              </pre>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <ExternalLink href={d.source} className="text-xs text-neutral-400">
                  Template: {hostname(d.source)}
                </ExternalLink>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => copy(d)}>
                    {copied === d.id ? "Copied" : "Copy"}
                  </Button>
                  <Button size="sm" onClick={() => api.pdf(profile, countryCode, d.id).catch((e) => setError(e.message))}>
                    Download PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
