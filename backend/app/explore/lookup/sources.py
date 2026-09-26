"""Cached, deadline-bounded fetching for the lookup module.

fetch_many() takes {cache_key: fetch_fn}. For each key it serves the cached JSON if present; otherwise it
starts fetch_fn in a worker thread and waits until one shared deadline (LOOKUP_TIMEOUT, default 8 s). Calls
that finish in time are returned as "live"; slower ones keep running in the background (up to
BACKGROUND_TIMEOUT) and write the cache when they land, so the answer is "pending" now and "cache" on the
next request. Errors are never cached (the next request retries); "no records" answers are cached as None.
"""

import json
import logging
import os
import re
import threading
import time
from concurrent.futures import Future
from concurrent.futures import TimeoutError as FutureTimeout
from datetime import datetime, timezone
from pathlib import Path
from typing import Callable, Literal

log = logging.getLogger("portage.explore.lookup")

CACHE_DIR = Path(__file__).resolve().parents[3] / "data" / "auto" / "cache"
LOOKUP_TIMEOUT = float(os.getenv("LOOKUP_TIMEOUT", "8"))           # what a request waits, seconds
BACKGROUND_TIMEOUT = float(os.getenv("LOOKUP_BACKGROUND_TIMEOUT", "90"))  # what a background call may take
CACHE_VERSION = 2  # bump when a fetcher's parsing changes: older records are ignored and refetched
USER_AGENT = "Portage/0.1 (AF Hacks prototype; export market research)"

Origin = Literal["cache", "live", "pending", "error"]

_slots = threading.BoundedSemaphore(40)  # concurrent source calls


def _submit(fn, *args) -> Future:
    """Run fn in a DAEMON thread: a slow WITS call must never hold up a server reload or shutdown
    (ThreadPoolExecutor joins its workers at exit, which is how uvicorn --reload hangs)."""
    fut: Future = Future()

    def run():
        with _slots:
            if not fut.set_running_or_notify_cancel():
                return
            try:
                fut.set_result(fn(*args))
            except BaseException as e:  # noqa: BLE001 - handed to the waiting request
                fut.set_exception(e)

    threading.Thread(target=run, daemon=True, name="lookup-fetch").start()
    return fut
_inflight: dict[str, Future] = {}
_lock = threading.Lock()


class NoRecords(Exception):
    """The source answered, and it has no data for this query (cacheable)."""


def _safe(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", key)


def cache_path(key: str) -> Path:
    return CACHE_DIR / f"{_safe(key)}.json"


def read_cache(key: str) -> dict | None:
    """The cache record {key, fetched_at, url, payload}, or None when absent/unreadable."""
    p = cache_path(key)
    if not p.exists():
        return None
    try:
        rec = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        log.warning("unreadable cache file %s, ignoring", p.name)
        return None
    return rec if isinstance(rec, dict) and rec.get("v", 1) >= CACHE_VERSION else None


def write_cache(key: str, payload, url: str = "") -> None:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    rec = {"v": CACHE_VERSION, "key": key, "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "url": url, "payload": payload}
    tmp = cache_path(key).with_suffix(".tmp")
    tmp.write_text(json.dumps(rec, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, cache_path(key))


# UN Comtrade's public preview answers 429 when hit in parallel: one call at a time, spaced out.
MIN_INTERVAL_S = {"comtradeapi.un.org": 1.1}
RETRY_429 = (2.0, 5.0, 10.0)
_host_locks: dict[str, threading.Lock] = {}
_host_last: dict[str, float] = {}


def _host_lock(host: str) -> threading.Lock:
    with _lock:
        return _host_locks.setdefault(host, threading.Lock())


def http_get_json(url: str, timeout: float | None = None):
    """GET a JSON document. Raises NoRecords on a 404 'no records' answer; other failures raise.
    Throttles hosts listed in MIN_INTERVAL_S and retries 429s with backoff.
    Tests replace this function to keep the suite offline."""
    import httpx  # lazy: keeps import of the module cheap
    from urllib.parse import urlparse

    host = urlparse(url).netloc
    interval = MIN_INTERVAL_S.get(host, 0.0)
    for attempt in range(len(RETRY_429) + 1):
        if interval:
            with _host_lock(host):
                wait = _host_last.get(host, 0.0) + interval - time.monotonic()
                if wait > 0:
                    time.sleep(wait)
                try:
                    r = httpx.get(url, timeout=timeout or BACKGROUND_TIMEOUT, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
                finally:
                    _host_last[host] = time.monotonic()
        else:
            r = httpx.get(url, timeout=timeout or BACKGROUND_TIMEOUT, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
        if r.status_code == 429 and attempt < len(RETRY_429):
            time.sleep(RETRY_429[attempt])
            continue
        break
    if r.status_code == 404:
        raise NoRecords(r.text[:200])
    r.raise_for_status()
    return parse_json(r.text)


def parse_json(text: str):
    """json.loads, tolerating WITS's empty array slots ('[,0,null]' for a year with no value)."""
    try:
        return json.loads(text)
    except ValueError:
        fixed = re.sub(r"(?<=\[)\s*(?=,)|(?<=,)\s*(?=[,\]])", "null", text)  # "[]" stays empty
        return json.loads(fixed)


def _run_and_store(key: str, fn: Callable[[], tuple[object, str]]):
    try:
        try:
            payload, url = fn()
        except NoRecords:
            payload, url = None, ""
        except Exception as e:
            log.warning("lookup fetch %s failed: %s", key, e)  # also logged when nobody is waiting any more
            raise
        write_cache(key, payload, url)
        return payload
    finally:
        with _lock:
            _inflight.pop(key, None)


def fetch_many(jobs: dict[str, Callable[[], tuple[object, str]]], timeout: float | None = None,
               refresh: bool = False) -> dict[str, tuple[object, Origin]]:
    """Resolve every job: {key: (payload or None, origin)}. fn returns (payload, source_url)."""
    timeout = LOOKUP_TIMEOUT if timeout is None else timeout
    out: dict[str, tuple[object, Origin]] = {}
    futures: dict[str, Future] = {}
    for key, fn in jobs.items():
        rec = None if refresh else read_cache(key)
        if rec is not None:
            out[key] = (rec.get("payload"), "cache")
            continue
        with _lock:
            fut = _inflight.get(key)
            if fut is None:
                fut = _submit(_run_and_store, key, fn)
                _inflight[key] = fut
        futures[key] = fut

    deadline = time.monotonic() + timeout
    for key, fut in futures.items():
        try:
            out[key] = (fut.result(timeout=max(0.0, deadline - time.monotonic())), "live")
        except FutureTimeout:
            out[key] = (None, "pending")
        except Exception as e:  # network error, bad JSON, HTTP 5xx: degrade this one piece, never the request
            log.warning("lookup fetch %s failed: %s", key, e)
            out[key] = (None, "error")
    return out


def pending_count() -> int:
    with _lock:
        return len(_inflight)
