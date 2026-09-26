// EXPERIMENTAL lab page, only rendered at /?lab=1. Owned by session C (see project doc claude/afhacks-lab-C.md).
// Talks only to /api/explore/* (backend EXPERIMENTAL=1). Never imported by the demo app.
export default function LabApp() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <p className="text-xs uppercase tracking-wide text-neutral-400">Portage lab</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Any product (experimental)</h1>
      <p className="mt-3 text-neutral-500">Nothing here yet.</p>
    </main>
  );
}
