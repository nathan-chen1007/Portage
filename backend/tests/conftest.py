import sys
from pathlib import Path

# Let tests import the `app` package when run from backend/ with `python -m pytest`.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def _no_network(monkeypatch):
    """Tests never touch the network: live sources must degrade to cache, then "unknown". Tests that simulate a
    source replace the module-level fetch functions themselves."""
    import httpx

    def blocked(*a, **k):
        raise httpx.ConnectError("network disabled in tests")

    monkeypatch.setattr(httpx, "get", blocked)
    monkeypatch.setattr(httpx, "post", blocked)
