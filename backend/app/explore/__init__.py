"""EXPERIMENTAL: auto-sourced compliance (session B) and any-product lookup (session C).

Mounted only when EXPERIMENTAL=1 in backend/.env. Nothing here may change the behaviour of the curated
honey/SaaS paths (/api/analyze, /api/rank, ...): those are the demo, and their tests must stay green.

Each sub-package exposes an optional `routes.py` with `router = APIRouter()`; routes are mounted under
/api/explore/<name>. Adding a routes.py is all a session needs to do — no edits to main.py.
"""

import importlib
import logging

from fastapi import APIRouter

log = logging.getLogger("portage.explore")

router = APIRouter(prefix="/api/explore", tags=["experimental"])


@router.get("/health")
def explore_health() -> dict:
    return {"experimental": True, "modules": sorted(_loaded)}


_loaded: set[str] = set()
for _name in ("compliance", "lookup"):
    try:
        _mod = importlib.import_module(f"app.explore.{_name}.routes")
    except ModuleNotFoundError as e:
        if e.name != f"app.explore.{_name}.routes":
            log.exception("experimental module %s failed to import", _name)
        continue
    except Exception:  # a broken experiment must never take down the demo API
        log.exception("experimental module %s failed to import", _name)
        continue
    if getattr(_mod, "router", None) is not None:
        router.include_router(_mod.router, prefix=f"/{_name}")
        _loaded.add(_name)
