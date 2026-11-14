"""Optional real-NASA checks for the shared orchestration APIs."""

import pytest
from fastapi.testclient import TestClient

from app.main import create_app


pytestmark = pytest.mark.live


def test_live_shared_workflows_use_real_visibility_results():
    """Exercise all orchestration routes with real Horizons responses, not fixtures."""
    with TestClient(create_app()) as client:
        comparison = client.post("/api/compare", json={
            "locations": [
                {"label": "Site A", "latitude_deg": -85.2, "longitude_deg": 32.5},
                {"label": "Site B", "latitude_deg": -85.2, "longitude_deg": 33.5},
            ],
            "start_utc": "2026-11-20T00:00:00Z",
            "duration_hours": 1,
            "include_terrain": False,
        })
        stress = client.post("/api/stress-test", json={
            "latitude_deg": -85.2,
            "longitude_deg": 32.5,
            "baseline": {"start_utc": "2026-11-20T00:00:00Z", "duration_hours": 1},
            "variant": {"start_utc": "2026-11-21T00:00:00Z", "duration_hours": 1},
        })
        windows = client.post("/api/mission-windows", json={
            "latitude_deg": -85.2,
            "longitude_deg": 32.5,
            "target_start_utc": "2026-11-20T00:00:00Z",
            "duration_hours": 1,
            "candidate_offsets_days": [0, 1],
        })
        replay = client.post("/api/missions/chandrayaan_3/replay", json={"duration_hours": 1})

    assert comparison.status_code == stress.status_code == windows.status_code == replay.status_code == 200
    assert len(comparison.json()["results"]) == 2
    assert all(item["status"] == "ok" for item in comparison.json()["results"])
    assert stress.json()["baseline"]["timeline"][0]["sample_utc"] == "2026-11-20T00:30:00Z"
    assert len(windows.json()["evaluated_windows"]) == 2
    assert replay.json()["historical_context"]["mission_id"] == "chandrayaan_3"
    assert len(replay.json()["analysis"]["timeline"]) == 1
