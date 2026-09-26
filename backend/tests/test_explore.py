"""The experimental routes must stay off unless EXPERIMENTAL=1, and must mount cleanly when on."""

from fastapi import FastAPI
from fastapi.testclient import TestClient


def test_experimental_routes_are_off_by_default():
    from app import main

    if not main.EXPERIMENTAL:
        assert TestClient(main.app).get("/api/explore/health").status_code == 404


def test_experimental_router_mounts_on_its_own():
    from app.explore import router

    app = FastAPI()
    app.include_router(router)
    r = TestClient(app).get("/api/explore/health")
    assert r.status_code == 200 and r.json()["experimental"] is True
