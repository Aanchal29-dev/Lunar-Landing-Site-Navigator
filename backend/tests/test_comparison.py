from datetime import UTC, datetime, timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import (
    AnalysisRequest,
    AnalysisResponse,
    Location,
    Metrics,
    ModelMetadata,
    TimelineEntry,
)
from app.services.horizons import HorizonsError


async def fake_analyze_visibility(body: AnalysisRequest, client) -> AnalysisResponse:
    sun_pct = round(min(100.0, abs(body.latitude_deg) * 0.8 + (body.start_utc.day % 10)), 2)
    earth_pct = round(min(100.0, 50.0 + (abs(body.longitude_deg) % 20)), 2)
    dark_h = max(1, body.duration_hours // 6)
    gap_h = max(1, body.duration_hours // 8)

    timeline = [
        TimelineEntry(
            interval_start_utc=body.start_utc + timedelta(hours=h),
            interval_end_utc=body.start_utc + timedelta(hours=h + 1),
            sample_utc=body.start_utc + timedelta(hours=h, minutes=30),
            sun_azimuth_deg=180.0,
            sun_elevation_deg=5.0 if h >= dark_h else -5.0,
            earth_azimuth_deg=90.0,
            earth_elevation_deg=10.0 if h >= gap_h else -2.0,
            sun_visible=h >= dark_h,
            earth_visible=h >= gap_h,
        )
        for h in range(body.duration_hours)
    ]

    return AnalysisResponse(
        location=Location(latitude_deg=body.latitude_deg, longitude_deg=body.longitude_deg),
        start_utc=body.start_utc,
        end_utc=body.start_utc + timedelta(hours=body.duration_hours),
        duration_hours=body.duration_hours,
        metrics=Metrics(
            sunlight_percent=sun_pct,
            earth_visibility_percent=earth_pct,
            longest_darkness_hours=dark_h,
            longest_earth_gap_hours=gap_h,
        ),
        timeline=timeline,
        model=ModelMetadata(lunar_reference_frame="MOON_ME", lunar_radii_km=(1737.4, 1737.4, 1737.4)),
    )


@patch("app.comparison_service._lookup_terrain_safe", return_value={"terrain_available": False, "warnings": ["Outside coverage"]})
@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
@patch("app.main.analyze_visibility", side_effect=fake_analyze_visibility)
def test_compare_matches_standalone_and_handles_missing_terrain(mock_main_vis, mock_comp_vis, mock_ter):
    with TestClient(app) as client:
        site_a = {"latitude_deg": -85.0, "longitude_deg": 10.0}
        site_b = {"latitude_deg": -45.0, "longitude_deg": 25.0}
        common = {"start_utc": "2027-01-15T00:00:00Z", "duration_hours": 144}

        single_res = client.post("/api/analyze", json={**site_a, **common})
        assert single_res.status_code == 200

        comp_res = client.post("/api/compare", json={"locations": [site_a, site_b], **common})
        assert comp_res.status_code == 200
        data = comp_res.json()

        assert data["results"]["visibility"]["metrics"] == single_res.json()["metrics"]
        assert data["results"]["terrain_available"] is False
        assert len(data["tradeoffs"]) >= 1


@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_stress_test_triggers_fresh_calculation(mock_vis):
    with TestClient(app) as client:
        payload = {
            "latitude_deg": -85.0,
            "longitude_deg": 10.0,
            "baseline": {"start_utc": "2027-02-01T00:00:00Z", "duration_hours": 144},
            "variant": {"start_utc": "2027-02-04T00:00:00Z", "duration_hours": 96},
        }
        res = client.post("/api/stress-test", json=payload)
        assert res.status_code == 200
        data = res.json()

        assert mock_vis.call_count == 2
        assert len(data["baseline"]["timeline"]) == 144
        assert len(data["variant"]["timeline"]) == 96
        assert data["deltas"]["duration_hours_delta"] == -48


@patch("app.comparison_service._lookup_terrain_safe", return_value={"terrain_available": False})
@patch("app.comparison_service.analyze_visibility")
def test_compare_handles_partial_failure_and_invalid_inputs(mock_vis, mock_ter):
    async def partial_fail(body: AnalysisRequest, client):
        if body.latitude_deg == -89.0:
            raise HorizonsError("JPL Horizons timeout", status_code=504)
        return await fake_analyze_visibility(body, client)

    mock_vis.side_effect = partial_fail

    with TestClient(app) as client:
        # Partial failure handled transparently
        res = client.post(
            "/api/compare",
            json={
                "locations": [
                    {"latitude_deg": -85.0, "longitude_deg": 10.0},
                    {"latitude_deg": -89.0, "longitude_deg": 20.0},
                ],
                "start_utc": "2027-01-15T00:00:00Z",
                "duration_hours": 72,
            },
        )
        assert res.status_code == 200
        results = res.json()["results"]
        assert results["status"] == "ok"
        assert results["status"] == "error"
        assert results["visibility"] is None

        # Invalid single location rejected
        bad_len = client.post(
            "/api/compare",
            json={
                "locations": [{"latitude_deg": -85.0, "longitude_deg": 10.0}],
                "start_utc": "2027-01-15T00:00:00Z",
                "duration_hours": 72,
            },
        )
        assert bad_len.status_code == 422


@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_mission_windows_evaluates_all_candidates(mock_vis):
    with TestClient(app) as client:
        res = client.post(
            "/api/mission-windows",
            json={
                "latitude_deg": -85.0,
                "longitude_deg": 10.0,
                "target_start_utc": "2027-03-10T00:00:00Z",
                "duration_hours": 144,
                "candidate_offsets_days": [-3, 0, 3],
            },
        )
        assert res.status_code == 200
        data = res.json()

        assert mock_vis.call_count == 3
        assert data["is_globally_optimal"] is False
        assert data["preferred_window"]["offset_days"] in [-3, 0, 3]
