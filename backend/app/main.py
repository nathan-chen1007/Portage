"""Portage API."""

import base64
import logging
import os
import re
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

load_dotenv()

from app.engine.scoring import load_catalog, middlemen_for, rank_markets  # noqa: E402
from app.models import (  # noqa: E402
    AnalyzeRequest,
    AnalyzeResponse,
    Category,
    DocumentDraft,
    DocumentRequest,
    MarketEntry,
    OutreachDraft,
    OutreachRequest,
    RankRequest,
    ScoredMarket,
    VoiceRequest,
    VoiceResponse,
)
from app.services import documents, llm, voice  # noqa: E402

log = logging.getLogger("portage")

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
catalog = load_catalog(DATA_DIR)  # validated once at startup: bad data stops the server immediately

app = FastAPI(title="Portage API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _category(category_id: str) -> Category:
    cat = catalog.categories.get(category_id)
    if not cat:
        raise HTTPException(422, f"Unsupported category '{category_id}'")
    return cat


def _open_market(category_id: str, country_code: str) -> MarketEntry:
    entry = catalog.market(category_id, country_code.upper())
    if not entry:
        raise HTTPException(404, f"No data for {category_id} in {country_code}")
    if entry.status == "blocked":
        raise HTTPException(422, f"{entry.country} is not currently accessible: {entry.status_note}")
    return entry


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "markets": len(catalog.markets),
        "categories": list(catalog.categories),
        "llm": llm.is_configured(),
        "voice": voice.is_configured(),
    }


@app.get("/api/categories", response_model=list[Category])
def categories() -> list[Category]:
    return list(catalog.categories.values())


@app.post("/api/rank", response_model=list[ScoredMarket])
def rank(req: RankRequest) -> list[ScoredMarket]:
    """Every market for a category, best first (sort_by: overall | friction | opportunity), blocked last.
    Optional friction weights and prize_weight (0 = quick wins, 1 = biggest prize)."""
    _category(req.category)
    try:
        return rank_markets(req.category, catalog, req.weights, req.sort_by, req.prize_weight)
    except ValueError as e:  # e.g. all-zero weights
        raise HTTPException(422, str(e))


@app.post("/api/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Founder's description -> structured profile (LLM) -> ranked markets with partners (engine).

    If the LLM isn't configured or fails, falls back to keyword matching so the demo never dead-ends.
    """
    cats = list(catalog.categories.values())
    mode = "llm"
    try:
        profile = llm.extract_profile(req.description, cats)
    except Exception as e:  # no key, network error, bad model output
        log.warning("profile extraction fell back to offline mode: %s", e)
        profile, mode = llm.fallback_profile(req.description, cats), "offline"
    cat = catalog.categories.get(profile.category)
    markets = rank_markets(cat.id, catalog) if cat else []
    return AnalyzeResponse(profile=profile, category=cat, markets=markets, mode=mode,
                           opportunity_available=bool(cat and cat.id in catalog.trade))


@app.post("/api/documents", response_model=list[DocumentDraft])
def make_documents(req: DocumentRequest) -> list[DocumentDraft]:
    """Paperwork drafts for one market: origin declaration (if the FTA saves duty), DPA (SaaS into EU/UK), checklist."""
    cat = _category(req.profile.category)
    return documents.drafts_for(req.profile, cat, _open_market(cat.id, req.country_code))


@app.post("/api/documents/{doc_id}/pdf")
def document_pdf(doc_id: str, req: DocumentRequest) -> Response:
    for d in make_documents(req):
        if d.id == doc_id:
            filename = f"{doc_id}-{req.country_code.upper()}.pdf"
            return Response(documents.to_pdf(d), media_type="application/pdf",
                            headers={"Content-Disposition": f'attachment; filename="{filename}"'})
    raise HTTPException(404, f"No document '{doc_id}' for this market")


@app.post("/api/outreach", response_model=OutreachDraft)
def outreach(req: OutreachRequest) -> OutreachDraft:
    """English first-contact email to a curated partner, drafted only from sourced facts. The founder edits
    and approves it before anything else happens (nothing is ever sent automatically)."""
    cat = _category(req.profile.category)
    entry = _open_market(cat.id, req.country_code)
    mm = next((m for m in middlemen_for(catalog, cat.id, entry.country_code) if m.id == req.middleman_id), None)
    if not mm:
        raise HTTPException(404, f"Unknown partner '{req.middleman_id}' for {entry.country}")
    try:
        return llm.draft_outreach(req.profile, entry, mm)
    except Exception as e:
        log.warning("outreach drafting fell back to the template: %s", e)
        return llm.fallback_outreach(req.profile, entry, mm)


@app.post("/api/voice", response_model=VoiceResponse)
def make_voice(req: VoiceRequest) -> VoiceResponse:
    """Only called on the founder's approved text: translate to a short spoken script in the partner's
    language (LLM), then speak it in the founder's cloned voice (ElevenLabs)."""
    language = req.language
    try:
        script = llm.voice_script(req.text, req.language)
    except Exception as e:  # LLM down: still produce a voice note, in English
        log.warning("voice script translation failed, speaking the English text: %s", e)
        script, language = re.sub(r"\[[^\]]*\]", "", req.text).strip(), "en"
    try:
        audio = voice.synthesize(script)
    except Exception as e:
        raise HTTPException(502, f"Voice generation failed: {e}")
    return VoiceResponse(script=script, language=language, audio_base64=base64.b64encode(audio).decode())
