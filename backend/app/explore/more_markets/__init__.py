"""Lab session E: "More markets" (FR, NL, IT, VN, SG, NZ, IN, AE) as ranking-only. See claude/afhacks-lab-E.md.

Tariffs (WITS/TRAINS) and trade data (UN Comtrade) through the any-product lookup's source functions, opportunity
from the unchanged engine, compliance always "unknown" and no ease/overall score. Cache:
backend/data/auto/cache/more_markets/ (pre-warm: python -m app.explore.more_markets.prewarm).
Integration: app.include_router(router) in main.py.
"""

from app.explore.more_markets.routes import router  # noqa: F401
