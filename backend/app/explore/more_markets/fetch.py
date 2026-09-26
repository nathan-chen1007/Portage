"""Cached, deadline-bounded fetching for the "More markets" section.

Same record format and behaviour as the lookup's sources.fetch_many (whose HTTP helper, daemon threads and WITS /
Comtrade throttling we reuse), but our cache lives in its own folder, backend/data/auto/cache/more_markets/, so
the any-product lookup's cache is never touched. Cache first; otherwise a live call bounded by one shared
deadline; slower calls keep running in the background and fill the cache. Errors are never cached; a source's
"no records" answer is cached as None.
"""

import json
import logging
import os
import threading
import time
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeout
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable

from app.explore.lookup import sources

log = logging.getLogger("portage.explore.more_markets")

CACHE_DIR: Path = sources.CACHE_DIR / "more_markets"

_inflight: dict[str, Future] = {}
_lock = threading.Lock()


def cache_path(key: str) -> Path:
    return CACHE_DIR / f"{sources._safe(key)}.json"


def read_cache(key: str) -> dict | None:
    p = cache_path(key)
    if not p.exists():
        return None
    try:
        rec = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.warning("unreadable cache file %s, ignoring", p.name)
        return None
    return rec if isinstance(rec, dict) and rec.get("v", 1) >= sources.CACHE_VERSION else None


def write_cache(key: str, payload, url: str = "") -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    rec = {"v": sources.CACHE_VERSION, "key": key, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
           "url": url, "payload": payload}
    tmp = cache_path(key).with_suffix(".tmp")
    tmp.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, cache_path(key))


def _run_and_store(key: str, fn: Callable[[], tuple[object, str]]):
    try:
        try:
            payload, url = fn()
        except sources.NoRecords:
            payload, url = None, ""
        write_cache(key, payload, url)
        return payload
    finally:
        with _lock:
            _inflight.pop(key, None)


def fetch_many(jobs: dict[str, Callable[[], tuple[object, str]]], timeout: float | None = None,
               refresh: bool = False) -> dict[str, tuple[object, str, str]]:
    """{key: (payload or None, origin, fetched_at)}; origin is cache | live | pending | error."""
    timeout = sources.LOOKUP_TIMEOUT if timeout is None else timeout
    out: dict[str, tuple[object, str, str]] = {}
    futures: dict[str, Future] = {}
    for key, fn in jobs.items():
        rec = None if refresh else read_cache(key)
        if rec is not None:
            out[key] = (rec.get("payload"), "cache", str(rec.get("fetched_at", ""))[:10])
            continue
        with _lock:
            fut = _inflight.get(key)
            if fut is None:
                fut = sources._submit(_run_and_store, key, fn)
                _inflight[key] = fut
        futures[key] = fut

    today = datetime.now(timezone.utc).date().isoformat()
    deadline = time.monotonic() + timeout
    for key, fut in futures.items():
        try:
            out[key] = (fut.result(timeout=max(0.0, deadline - time.monotonic())), "live", today)
        except FutureTimeout:
            out[key] = (None, "pending", "")
        except Exception as e:  # network error, bad JSON, HTTP 5xx: degrade this piece only
            log.warning("more-markets fetch %s failed: %s", key, e)
            out[key] = (None, "error", "")
    return out
