# Portage backend

FastAPI service: sourced market data, the friction scoring engine, and the AI steps (profile extraction, outreach drafts, voice notes).

## Run it (Windows PowerShell)

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env   # then paste your keys into .env
uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs for the interactive API.
