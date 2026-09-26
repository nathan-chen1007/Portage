"""Portage API."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from app.engine.scoring import load_catalog, rank_markets  # noqa: E402
from app.models import Category, MarketEntry, RankRequest, ScoredMarket  # noqa: E402

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
