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

The tests mock the backend, so they pass without it running. They cover the API client's error handling, the friction bar, the market list (including blocked markets), and the main flows: describe → ranking → detail, browsing a category, and the messages shown when the backend is down or a feature isn't built yet.

## How it's put together

| File | What it does |
|---|---|
| `src/lib/api.js` | Fetch client for every backend route. Error messages come from the backend's `detail` field. Types live in `../docs/contract/api.ts`. |
| `src/lib/format.js` | Colours for the four friction components (a fixed, colour-blind-safe order), flags, percentages. |
| `src/App.jsx` | Page flow: backend health check, description form, example prompts, category browsing, weight sliders, results. |
| `src/components/MarketList.jsx` | Ranked markets with stacked friction bars. Blocked markets are greyed out, show their reason and are always listed last. |
| `src/components/MarketDetail.jsx` | The selected market, in three tabs: why this score (with sources), paperwork, and partners & outreach. |
| `src/components/DocumentsPanel.jsx` | Drafts from `/api/documents`, with copy and PDF download. |
| `src/components/OutreachPanel.jsx` | Real partners, a drafted email you can edit, and an approve step that creates a voice note in the importer's language (`/api/outreach`, `/api/voice`). |
| `src/components/WeightsPanel.jsx` | Sliders that re-rank the markets through `/api/rank` with custom weights. |

If a backend route isn't built yet, the app says so where that feature appears instead of crashing.

## Build for production

```powershell
npm run build      # outputs dist/
npm run preview    # serves dist/ on http://localhost:3000
```
