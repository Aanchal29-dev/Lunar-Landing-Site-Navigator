"""Tests for source-backed Historical Mission Explorer records."""

from datetime import timedelta

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.data.historical_missions import MISSIONS, SOURCES
from app.historical_router import _visibility_longitude, router
from app.main import create_app
from app.models import AnalysisResponse
from app.services.historical_missions import (
    get_mission_detail,
    get_replay_input,
    list_mission_summaries,
    validate_historical_dataset,
)


@pytest.fixture
def historical_client():
    app = FastAPI()
    app.include_router(router)
    with TestClient(app) as client:
        yield client


def test_all_historical_records_validate_with_sources_and_coordinates():
    validate_historical_dataset()
    assert len(MISSIONS) == 6

    for raw_mission in MISSIONS:
        mission = get_mission_detail(raw_mission["id"])
        assert mission is not None
        assert mission.event_time_utc.utcoffset() == timedelta(0)
        assert -90 <= mission.actual_location.latitude_deg <= 90
        assert 0 <= mission.actual_location.longitude_deg < 360
        assert [source.key for source in mission.sources] == raw_mission["source_keys"]
        assert all(source.key in SOURCES for source in mission.sources)


def test_history_is_separate_from_modeled_replay_output():
    mission = get_mission_detail("chandrayaan_3")
    assert mission is not None

    payload = mission.model_dump(mode="json")
    assert "sources" in payload
    assert "replay" in payload
    assert "timeline" not in payload
    assert "metrics" not in payload

    replay_input = get_replay_input("chandrayaan_3")
    assert replay_input is not None
    assert replay_input.historical_context.mission_id == mission.id
    assert replay_input.latitude_deg == mission.actual_location.latitude_deg
    assert replay_input.longitude_deg == mission.actual_location.longitude_deg


def test_service_filters_and_invalid_inputs():
    assert len(list_mission_summaries(country="India")) == 2
    assert len(list_mission_summaries(landing_outcome="successful_soft_landing")) == 3
    assert list_mission_summaries(country="Japan") == []
    assert get_mission_detail("unknown") is None

    with pytest.raises(ValueError, match="country cannot be empty"):
        list_mission_summaries(country="  ")

    with pytest.raises(ValueError, match="mission_id cannot be empty"):
        get_mission_detail(" ")


def test_mission_routes_return_expected_history(historical_client):
    missions = historical_client.get("/api/missions")
    assert missions.status_code == 200
    assert len(missions.json()) == 6
    assert "intended_location" not in missions.json()[0]

    india = historical_client.get("/api/missions", params={"country": "India"})
    assert india.status_code == 200
    assert [mission["id"] for mission in india.json()] == [
        "chandrayaan_3",
        "chandrayaan_2_vikram",
    ]

    detail = historical_client.get("/api/missions/chandrayaan_3")
    assert detail.status_code == 200
    assert detail.json()["actual_location"]["latitude_deg"] == -69.3741
    assert [source["key"] for source in detail.json()["sources"]] == [
        "CY3-1",
        "CY3-2",
        "CY3-3",
    ]


def test_mission_route_failures_are_clear(historical_client):
    missing = historical_client.get("/api/missions/not-a-mission")
    assert missing.status_code == 404
    assert missing.json() == {"detail": "Mission not found"}

    invalid = historical_client.get("/api/missions", params={"country": "  "})
    assert invalid.status_code == 422
    assert invalid.json() == {"detail": "country cannot be empty"}


@pytest.mark.parametrize(("historical", "visibility"), [(32.32, 32.32), (180.0, 180.0), (222.498015, -137.501985)])
def test_replay_longitude_is_compatible_with_visibility_engine(historical, visibility):
    assert _visibility_longitude(historical) == pytest.approx(visibility)


def test_historical_replay_uses_shared_visibility_engine(monkeypatch):
    captured = []

    async def fake_visibility(request, _http_client):
        captured.append(request)
        return AnalysisResponse.model_validate({
            "location": {"latitude_deg": request.latitude_deg, "longitude_deg": request.longitude_deg},
            "start_utc": request.start_utc,
            "end_utc": request.start_utc + timedelta(hours=request.duration_hours),
            "duration_hours": request.duration_hours,
            "metrics": {
                "sunlight_percent": 100, "earth_visibility_percent": 100,
                "longest_darkness_hours": 0, "longest_earth_gap_hours": 0,
            },
            "timeline": [{
                "interval_start_utc": request.start_utc,
                "interval_end_utc": request.start_utc,
                "sample_utc": request.start_utc,
                "sun_azimuth_deg": 0, "sun_elevation_deg": 1,
                "earth_azimuth_deg": 0, "earth_elevation_deg": 1,
                "sun_visible": True, "earth_visible": True,
            }],
            "model": {"lunar_reference_frame": "test", "lunar_radii_km": [1, 1, 1]},
        })

    monkeypatch.setattr("app.historical_router.analyze_visibility", fake_visibility)
    with TestClient(create_app()) as client:
        response = client.post("/api/missions/chandrayaan_3/replay", json={"duration_hours": 1})

    assert response.status_code == 200
    body = response.json()
    assert body["historical_context"] == {
        "mission_id": "chandrayaan_3", "location_label": "Actual landing site",
        "location_type": "actual_landing", "coordinate_quality": "confirmed",
    }
    assert body["analysis"]["location"] == {"latitude_deg": -69.3741, "longitude_deg": 32.32}
    assert body["analysis"]["duration_hours"] == 1
    assert len(body["analysis"]["timeline"]) == 1
    assert len(captured) == 1
    assert captured[0].longitude_deg == pytest.approx(32.32)


def test_historical_replay_route_rejects_unknown_mission_without_calling_engine(monkeypatch):
    async def unexpected_engine(*args):
        pytest.fail("The visibility engine must not run for an unknown mission")

    monkeypatch.setattr("app.historical_router.analyze_visibility", unexpected_engine)
    with TestClient(create_app()) as client:
        response = client.post("/api/missions/not-a-mission/replay", json={"duration_hours": 1})
    assert response.status_code == 404
    assert response.json() == {"detail": "Mission not found"}
