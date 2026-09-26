"""Portage API."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

load_dotenv()

from app.engine.scoring import load_catalog, rank_markets  # noqa: E402
from app.models import (  # noqa: E402
    AnalyzeRequest,
    AnalyzeResponse,
    Category,
    DocumentDraft,
    DocumentRequest,
    MarketEntry,
    RankRequest,
    ScoredMarket,
)
from app.services import documents, llm  # noqa: E402

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
    return {"status": "ok", "markets": len(catalog.markets), "categories": list(catalog.categories)}


@app.get("/api/categories", response_model=list[Category])
def categories() -> list[Category]:
    return list(catalog.categories.values())


@app.post("/api/rank", response_model=list[ScoredMarket])
def rank(req: RankRequest) -> list[ScoredMarket]:
    """Every market for a category, easiest first, blocked markets last. Optional custom weights."""
    _category(req.category)
    try:
        return rank_markets(req.category, catalog, req.weights)
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
    return AnalyzeResponse(profile=profile, category=cat, markets=markets, mode=mode)


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
