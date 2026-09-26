# Portage API

Base URL: `http://localhost:8000` (interactive docs at `/docs`). Types: `backend/app/models.py`, mirrored in `docs/contract/api.ts`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | | `{status, markets, categories}` |
| GET | `/api/categories` | | `Category[]` |
| POST | `/api/analyze` | `{description}` | `AnalyzeResponse` (profile + ranked markets) |
| POST | `/api/rank` | `{category, weights?}` | `ScoredMarket[]`, easiest first, blocked last |
| POST | `/api/documents` | `{profile, country_code}` | `DocumentDraft[]` |
| POST | `/api/documents/{id}/pdf` | `{profile, country_code}` | `application/pdf` |
| POST | `/api/outreach` | `{profile, country_code, middleman_id}` | `OutreachDraft` (English) |
| POST | `/api/voice` | `{text, language}` | `VoiceResponse` (script + base64 MP3) |

Errors come back as `{detail: "..."}` with 404 (unknown market or middleman), 422 (bad input or unsupported category) or 502 (LLM / ElevenLabs failed).

## Blocked markets

Some markets are closed to a product (Mexico doesn't accept Canadian honey). Those rows have `status: "blocked"`, `score: null`, empty `components`/`breakdown`, and a `status_note` explaining why. They are always ranked after every open market. Show them greyed out with the note, not a friction bar. `/api/documents` and `/api/outreach` return 422 for a blocked market.

## Demo category ids

- `honey` (goods, HS 0409.00)
- `b2b_saas` (services)
