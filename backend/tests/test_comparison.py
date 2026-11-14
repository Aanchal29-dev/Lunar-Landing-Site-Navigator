"""Offline integration tests for comparison, stress-test, and mission-window APIs."""

from datetime import timedelta
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import create_app
from app.models import AnalysisRequest, AnalysisResponse, Location, Metrics, ModelMetadata, TimelineEntry
from app.services.horizons import HorizonsError


async def fake_analyze_visibility(request: AnalysisRequest, _client) -> AnalysisResponse:
    """Deterministic stand-in used only to test orchestration, never scientific output."""
    darkness = max(1, request.duration_hours // 6)
    earth_gap = max(1, request.duration_hours // 8)
    timeline = [
        TimelineEntry(
            interval_start_utc=request.start_utc + timedelta(hours=hour),
            interval_end_utc=request.start_utc + timedelta(hours=hour + 1),
            sample_utc=request.start_utc + timedelta(hours=hour, minutes=30),
            sun_azimuth_deg=180.0,
            sun_elevation_deg=5.0 if hour >= darkness else -5.0,
            earth_azimuth_deg=90.0,
            earth_elevation_deg=10.0 if hour >= earth_gap else -2.0,
            sun_visible=hour >= darkness,
            earth_visible=hour >= earth_gap,
        )
        for hour in range(request.duration_hours)
    ]
    return AnalysisResponse(
        location=Location(latitude_deg=request.latitude_deg, longitude_deg=request.longitude_deg),
        start_utc=request.start_utc,
        end_utc=request.start_utc + timedelta(hours=request.duration_hours),
        duration_hours=request.duration_hours,
        metrics=Metrics(
            sunlight_percent=100 * (request.duration_hours - darkness) / request.duration_hours,
            earth_visibility_percent=100 * (request.duration_hours - earth_gap) / request.duration_hours,
            longest_darkness_hours=darkness,
            longest_earth_gap_hours=earth_gap,
        ),
        timeline=timeline,
        model=ModelMetadata(lunar_reference_frame="MOON_ME", lunar_radii_km=(1737.4, 1737.4, 1737.4)),
    )


@patch("app.comparison_service._lookup_terrain_safe", return_value={"terrain_available": False, "warnings": ["Outside coverage"]})
@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
@patch("app.main.analyze_visibility", side_effect=fake_analyze_visibility)
def test_compare_reuses_visibility_and_handles_missing_terrain(_main_visibility, comparison_visibility, terrain_lookup):
    with TestClient(create_app()) as client:
        site_a = {"latitude_deg": -85.0, "longitude_deg": 10.0}
        site_b = {"latitude_deg": -45.0, "longitude_deg": 25.0}
        shared = {"start_utc": "2027-01-15T00:00:00Z", "duration_hours": 144}
        standalone = client.post("/api/analyze", json=site_a | shared)
        response = client.post("/api/compare", json={"locations": [site_a, site_b]} | shared)

    assert standalone.status_code == response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2
    assert results[0]["visibility"]["metrics"] == standalone.json()["metrics"]
    assert all(item["terrain_available"] is False for item in results)
    assert comparison_visibility.call_count == 2
    assert terrain_lookup.call_count == 2


@patch("app.comparison_service._lookup_terrain_safe")
@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_compare_can_explicitly_skip_terrain(comparison_visibility, terrain_lookup):
    with TestClient(create_app()) as client:
        response = client.post("/api/compare", json={
            "locations": [
                {"latitude_deg": -85.0, "longitude_deg": 10.0},
                {"latitude_deg": -45.0, "longitude_deg": 25.0},
            ],
            "start_utc": "2027-01-15T00:00:00Z", "duration_hours": 72, "include_terrain": False,
        })

    assert response.status_code == 200
    assert all(item["terrain"] is None for item in response.json()["results"])
    assert "not requested" in response.json()["provenance"]["source_measurements"][1].lower()
    assert comparison_visibility.call_count == 2
    terrain_lookup.assert_not_called()


@patch("app.comparison_service._lookup_terrain_safe", return_value={"terrain_available": False, "warnings": ["No terrain"]})
@patch("app.comparison_service.analyze_visibility")
def test_compare_preserves_a_partial_visibility_failure(mock_visibility, _terrain_lookup):
    async def partial_failure(request: AnalysisRequest, client):
        if request.latitude_deg == -89.0:
            raise HorizonsError("NASA JPL Horizons timed out; retry later", status_code=504)
        return await fake_analyze_visibility(request, client)

    mock_visibility.side_effect = partial_failure
    with TestClient(create_app()) as client:
        response = client.post("/api/compare", json={
            "locations": [
                {"latitude_deg": -85.0, "longitude_deg": 10.0},
                {"latitude_deg": -89.0, "longitude_deg": 20.0},
            ],
            "start_utc": "2027-01-15T00:00:00Z", "duration_hours": 72,
        })

    assert response.status_code == 200
    successful, failed = response.json()["results"]
    assert successful["status"] == "ok"
    assert failed["status"] == "error"
    assert failed["visibility"] is None


@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_stress_test_runs_two_fresh_analyses(mock_visibility):
    with TestClient(create_app()) as client:
        response = client.post("/api/stress-test", json={
            "latitude_deg": -85.0, "longitude_deg": 10.0,
            "baseline": {"start_utc": "2027-02-01T00:00:00Z", "duration_hours": 144},
            "variant": {"start_utc": "2027-02-04T00:00:00Z", "duration_hours": 96},
        })

    assert response.status_code == 200
    assert mock_visibility.call_count == 2
    assert len(response.json()["baseline"]["timeline"]) == 144
    assert len(response.json()["variant"]["timeline"]) == 96
    assert response.json()["deltas"]["duration_hours_delta"] == -48


@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_mission_windows_evaluates_each_bounded_candidate(mock_visibility):
    with TestClient(create_app()) as client:
        response = client.post("/api/mission-windows", json={
            "latitude_deg": -85.0, "longitude_deg": 10.0,
            "target_start_utc": "2027-03-10T00:00:00Z", "duration_hours": 144,
            "candidate_offsets_days": [-3, 0, 3],
        })

    assert response.status_code == 200
    assert mock_visibility.call_count == 3
    body = response.json()
    assert body["is_globally_optimal"] is False
    assert body["preferred_window"]["offset_days"] in [-3, 0, 3]


def test_comparison_requests_reject_invalid_or_unbounded_windows():
    with TestClient(create_app()) as client:
        no_timezone = client.post("/api/compare", json={
            "locations": [{"latitude_deg": 0, "longitude_deg": 0}, {"latitude_deg": 1, "longitude_deg": 1}],
            "start_utc": "2027-01-15T00:00:00", "duration_hours": 24,
        })
        duplicate_offsets = client.post("/api/mission-windows", json={
            "latitude_deg": 0, "longitude_deg": 0, "target_start_utc": "2027-01-15T00:00:00Z",
            "candidate_offsets_days": [0, 0],
        })
        oversized_offset = client.post("/api/mission-windows", json={
            "latitude_deg": 0, "longitude_deg": 0, "target_start_utc": "2027-01-15T00:00:00Z",
            "candidate_offsets_days": [0, 366],
        })

    assert no_timezone.status_code == duplicate_offsets.status_code == oversized_offset.status_code == 422


@patch("app.comparison_service._lookup_terrain_safe", return_value={"terrain_available": False, "warnings": ["No terrain"]})
@patch("app.comparison_service.analyze_visibility", side_effect=fake_analyze_visibility)
def test_compare_accepts_a_documented_zero_to_360_historical_longitude(mock_visibility, _terrain_lookup):
    with TestClient(create_app()) as client:
        response = client.post("/api/compare", json={
            "locations": [
                {"label": "Historical", "latitude_deg": -89.4, "longitude_deg": 222.498015},
                {"label": "Clicked", "latitude_deg": -85.2, "longitude_deg": 32.5},
            ],
            "start_utc": "2027-01-15T00:00:00Z", "duration_hours": 24,
        })

    assert response.status_code == 200
    assert response.json()["results"][0]["longitude_deg"] == -137.501985
    assert mock_visibility.call_args_list[0].args[0].longitude_deg == -137.501985
