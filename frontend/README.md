# Portage frontend

The web app for Portage: React 19 + Vite, styled with Tailwind CSS v4, in plain JavaScript. It talks to the FastAPI backend in `../backend`.

## Run it (Windows PowerShell)

Start the backend first (see `../backend/README.md`), in its own terminal:

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload --port 8000
```

Then, in a second terminal:

```powershell
cd frontend
npm install        # first time only
npm run dev
```

Open http://localhost:3000. The pill in the top-right corner shows **Live data** once the backend is reachable.

The app must run on port 3000, because that's the origin the backend allows through CORS. To point at a different backend, copy `.env.example` to `.env.local` and change `VITE_API_URL`.

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
