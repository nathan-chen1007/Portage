"""Any-product mode, promoted into the main app (Sat Sept 26, ~8:30 PM).

  compliance  auto-sourced compliance (lab B): live UK Trade Tariff lookup + saved files, `auto_requirements()`
  lookup      any-product lookup (lab C): HS classification, live tariffs and trade data with cache

Routes are ALWAYS mounted under /api/explore/<name> (no EXPERIMENTAL flag any more). Imports are strict: a
broken module fails the test suite and the server start, it is never silently skipped. The curated honey and
SaaS paths don't call anything here; tests/test_curated_unchanged.py proves their outputs are unchanged.
"""

import logging

from fastapi import APIRouter

from app.explore.compliance.routes import router as compliance_router
from app.explore.lookup.routes import router as lookup_router

log = logging.getLogger("portage.explore")

MODULES = ("compliance", "lookup")

router = APIRouter(prefix="/api/explore", tags=["any-product"])
router.include_router(compliance_router, prefix="/compliance")
router.include_router(lookup_router, prefix="/lookup")


@router.get("/health")
def explore_health() -> dict:
    return {"modules": list(MODULES)}
