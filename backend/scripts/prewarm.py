"""Pre-warm the any-product caches for the demo products, so they work offline and never wait on stage.

Run from backend/ (with the venv active):   python scripts/prewarm.py            # hockey sticks + maple syrup
                                             python scripts/prewarm.py 030632     # any other HS6 codes

For each HS6 it fills: WITS/UNCTAD tariffs and UN Comtrade trade data (data/auto/cache/), and the live UK
Trade Tariff compliance lookup (data/auto/live/uk_<hs6>.json). Commit those files: they're the offline
snapshot the app falls back to. Every call keeps its timeout; anything that still fails shows as "unknown".
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from app.explore.compliance import live_uk  # noqa: E402
from app.explore.lookup import hs, service  # noqa: E402
from app.explore.lookup.schemas import LookupRankRequest  # noqa: E402

DEMO = {"950699": "hockey sticks", "170220": "maple syrup"}


def warm(hs6: str, label: str) -> bool:
    print(f"\n== {hs6} {label}: {hs.describe(hs6)}")
    uk = live_uk.uk_requirements(hs6)
    print("  UK compliance:", "unknown (no data)" if uk is None else
          f"{len(uk.requirements)} requirement(s), {'cached' if uk.from_cache else 'live'}")
    for attempt in range(1, 6):
        r = service.rank(LookupRankRequest(hs6=hs6, description=label), timeout=45)
        print(f"  attempt {attempt}: fetched {r.product.fetched}, pending={r.product.pending}")
        if not r.product.pending:
            break
        time.sleep(20)
    ok = True
    for s in r.data_status:
        print(f"  {s.country_code}: tariff={s.tariff:<12} trade={s.trade:<11} compliance={s.compliance_confidence}")
        ok &= s.tariff in ("ok", "mfn_only")
    print("  COMPLETE" if ok and not r.product.pending else "  INCOMPLETE: run again in a minute")
    return ok and not r.product.pending


if __name__ == "__main__":
    codes = [hs.normalize(a) for a in sys.argv[1:]] or list(DEMO)
    results = [warm(c, DEMO.get(c, "")) for c in codes]
    print("\nAll complete: commit backend/data/auto/cache and backend/data/auto/live." if all(results)
          else "\nSome sources are incomplete; run the script again.")
    sys.exit(0 if all(results) else 1)
