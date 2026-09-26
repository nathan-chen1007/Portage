"""The any-product routes are always mounted now, and a broken module must fail loudly (not be skipped)."""

import importlib

from fastapi.testclient import TestClient


def test_any_product_routes_always_mounted():
    from app import main

    client = TestClient(main.app)
    assert client.get("/api/explore/health").json() == {"modules": ["compliance", "lookup"]}
    paths = {r.path for r in main.app.routes}
    assert "/api/explore/lookup/rank" in paths and "/api/explore/compliance/{hs6}/{country_code}" in paths


def test_modules_import_strictly():
    for name in ["app.explore", "app.explore.compliance.routes", "app.explore.lookup.routes", "app.explore.lookup.compliance"]:
        importlib.import_module(name)  # any ImportError fails this test instead of being logged and skipped
