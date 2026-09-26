"""US Section 338 tariff (+50% on listed Canadian goods, effective Aug 22 2026, no CUSMA exemption).

The list is CBP's PDF. We keep the HTS numbers from it in backend/data/auto/cache/section338_hts.json
({source, as_of, hts: ["0409.00.00", ...]}). If that file is missing we answer "unknown" and the UI says
so: we never guess whether a 50% tariff applies.
"""

import json
import re

from app.explore.lookup import sources

RATE = 0.50
SOURCE = ("https://content.govdelivery.com/attachments/USDHSCBP/2026/08/21/file_attachments/3754630/"
          "Section%20338%20Canada%20HTS%20LIST%20Final.pdf")
AS_OF = "list of Aug 21 2026; re-scoped Sept 15, confirm with CBP"
FILE = "section338_hts.json"

_codes: set[str] | None = None
_mtime: float | None = None


def _load() -> set[str] | None:
    global _codes, _mtime
    p = sources.CACHE_DIR / FILE
    if not p.exists():
        _codes, _mtime = None, None
        return None
    mtime = p.stat().st_mtime
    if _codes is None or mtime != _mtime:
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
            _codes = {re.sub(r"\D", "", c) for c in raw.get("hts", []) if re.sub(r"\D", "", c)}
            _mtime = mtime
        except (OSError, ValueError):
            return None
    return _codes or None


def status(hs6: str) -> tuple[str, str]:
    """('listed' | 'not_listed' | 'unknown', source url)."""
    codes = _load()
    if not codes:
        return "unknown", SOURCE
    hit = any(c.startswith(hs6) or (len(c) < 6 and hs6.startswith(c)) for c in codes)  # line-level or whole heading
    return ("listed" if hit else "not_listed"), SOURCE
