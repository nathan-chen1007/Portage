"""Fill (and report) the More-markets cache for the demo products, so the stage demo makes no live call.

    cd backend && .venv\\Scripts\\python -m app.explore.more_markets.prewarm [hs6 ...]

Default: honey (040900) and icewine (220421). Waits up to 180 s per product; run again if anything is pending.
"""

import sys

from app.explore.more_markets import service
from app.explore.more_markets.markets import CATEGORY_HS6


def main(codes: list[str]) -> int:
    ok = True
    for code in codes:
        r = service.more_markets(code, timeout=180)
        done = service.cache_complete(code)
        ok &= done
        print(f"HS {r.hs6} {r.description[:60]}: cache {'COMPLETE' if done else 'INCOMPLETE'}")
        for m in r.markets:
            t = m.tariff
            rate = "-" if t.applied is None else f"{t.applied * 100:.1f}%"
            opp = "-" if m.opportunity is None else f"{m.opportunity:.1f}"
            print(f"  {m.country_code} tariff {rate:>7} {t.status:<11} {t.year or '':<5} {t.origin:<7} opp {opp:>5} "
                  f"{m.opportunity_status:<11} {t.agreement or ''}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:] or list(CATEGORY_HS6.values())))
