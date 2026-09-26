# Portage frontend

The web app for Portage: React 19 + Vite, styled with Tailwind CSS v4, in plain JavaScript. It talks to the FastAPI backend in `../backend`.

## Run it (Windows)

Easiest: double-click `backend\run.bat` and leave it running, then double-click `frontend\run.bat`. The frontend script installs packages, runs the tests and starts the app. Each writes its output to a `logs` folder next to it.

Or by hand, in two terminals:

```powershell
# terminal 1
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000

# terminal 2
cd frontend
npm install        # first time only
npm run dev
```

Open http://localhost:3000. The pill in the top-right corner shows **Live data** once the backend is reachable.

The dev server forwards `/api/*` and `/health` to the backend, so there's no CORS setup. It finds the backend port from `API_PORT` in `backend/.env` (8000 if unset), which is the same setting `backend\run.bat` uses. If Windows refuses port 8000 (`WinError 10013` in `backend/logs/server.log`), put e.g. `API_PORT=8765` in `backend/.env` and restart both.

## Test it

```powershell
npm test           # runs once
npm run test:watch # re-runs on save
```

The tests mock the backend, so they pass without it running. They cover the API client's error handling, the score bars, the market list (including blocked markets), and the main flows: the loading sequence and reveal, describe → ranking → market panel, expanding a factor, the factor panel, Tune presets, Ship together, and the messages shown when the backend is down or a feature isn't built yet.

## How it's put together

**The flow:** landing page → describe your business (or browse a category) → an animated loading sequence while the backend ranks markets → a two-panel workspace. Ranked markets are on the left; whatever you click opens on the right. Every score reads higher-is-better: Overall, Prize (opportunity) and Ease (100 − friction).

| File | What it does |
|---|---|
| `src/App.jsx` | Page flow and state: backend health check, landing page, loading sequence, top search bar, the workspace (view switch, factor chips, list/map toggle, Tune), and which panel is open on the right. |
| `src/lib/api.js` | Fetch client for every backend route. Error messages come from the backend's `detail` field. Types live in `../docs/contract/api.ts`. |
| `src/lib/format.js` | Factor definitions (colours in a fixed, colour-blind-safe order, weights, how each is measured), the ease/earned-points helpers, the three views, and number formatting. |
| `src/lib/together.js` | Sample producers and illustrative costs for the Ship together preview. Not live data. |
| `src/components/ui.jsx` | Shared pieces: buttons, pill toggles, styled sliders, score rings, meters, country-code chips, icons. |
| `src/components/LoadingScreen.jsx` | Full-screen progress sequence (ten named steps, progress bar). The real request runs alongside it, and the last step waits for the data. |
| `src/components/MarketList.jsx` | Ranked markets. The bar under each row shows where its number comes from; clicking a segment opens that factor. Blocked markets are greyed out, show their reason and come last. |
| `src/components/FrictionBar.jsx` | The ease and prize bars (points each part earns) and the clickable factor chips. |
| `src/components/MarketPanel.jsx` | One market: score rings, badges (agreement, language, lead time, compliance confidence, producers heading there), then tabs. Overview has factor tiles that expand in place; the other tabs are Paperwork, Partners & outreach, and Ship together. |
| `src/components/FactorPanel.jsx` | One factor across every market: what it measures, its weight slider, and markets ranked by it. |
| `src/components/TunePanel.jsx` | Popover with weight presets, per-factor sliders and the quick wins ↔ biggest prize balance. Re-ranks live through `/api/rank`. |
| `src/components/OpportunityMap.jsx` | Map layout: every market plotted by prize against ease. |
| `src/components/DocumentsPanel.jsx` | Drafts from `/api/documents`, with copy and PDF download. |
| `src/components/OutreachPanel.jsx` | Real partners, a drafted email you can edit, and an approve step that creates a voice note in the importer's language (`/api/outreach`, `/api/voice`). |
| `src/components/ShipTogether.jsx` | **Preview, sample data.** "Canada is stronger together": Canadian producers heading to the same market pool one shipment and split the fixed costs. Join adds you to the group. |
| `src/lab/` | Experimental any-product mode, only at `/?lab=1`. Not part of the demo. |

If a backend route isn't built yet, the app says so where that feature appears instead of crashing.

## Build for production

```powershell
npm run build      # outputs dist/
npm run preview    # serves dist/ on http://localhost:3000
```
