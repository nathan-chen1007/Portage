"""Session C: any-product lookup (HS classification, live tariffs and trade data). See claude/afhacks-lab-C.md.

    description --classify--> HS6 code --rank--> tariffs (WITS/TRAINS) + imports (UN Comtrade)
                                                 + shipping/LPI and country risk reused from the curated data
                                                 + compliance from session B's auto_requirements, or "unknown"
                                                 --> MarketEntry objects scored by the unchanged engine

Every network call goes through sources.fetch_many: cache first (backend/data/auto/cache/), then a live call
bounded by LOOKUP_TIMEOUT seconds. A call that is still running when the deadline passes keeps going in the
background and fills the cache, so the next request for that product is instant.
"""
