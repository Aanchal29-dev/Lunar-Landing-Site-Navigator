"""Tests for lunar water-ice proximity and planning-line calculations."""

import math

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.services.water_ice import (
    find_nearby_water_ice_sites,
    generate_navigation_path,
    moon_surface_distance_km,
)
from app.water_ice_models import Coordinate


@pytest.fixture
def client():
    with TestClient(create_app()) as test_client:
        yield test_client


def test_moon_haversine_distance_is_zero_for_one_coordinate():
    assert moon_surface_distance_km(-84.9, -35.5, -84.9, -35.5) == 0


def test_nearby_sites_are_limited_by_radius_and_sorted():
    sites = find_nearby_water_ice_sites(-84.9, -35.5, radius_km=250)
    assert sites
    assert sites[0].id == "cabeus_lcross_impact_site"
    assert sites == sorted(sites, key=lambda site: site.distance_km)


def test_navigation_path_preserves_start_and_target_coordinates():
    start = Coordinate(latitude=-85.0, longitude=-35.0)
    target = Coordinate(latitude=-84.9, longitude=-35.5)
    path = generate_navigation_path(start, target, segments=4)
    assert len(path.coordinates) == 5
    assert path.coordinates[0] == start
    assert path.coordinates[-1] == target


def test_analyze_site_endpoint_returns_source_backed_navigation_line():
    with TestClient(create_app()) as client:
        response = client.post(
            "/api/analyze-site",
            json={"lat": -85.0, "lon": -35.0, "search_radius_km": 250, "path_segments": 4},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["landing_coordinates"] == {"latitude": -85.0, "longitude": -35.0}
    assert body["nearest_water_ice_site"]["id"] == "cabeus_lcross_impact_site"
    assert len(body["navigation_path"]["coordinates"]) == 5
    assert "terrain-aware" in body["navigation_path"]["disclaimer"]


@pytest.mark.parametrize(
    "payload",
    [
        {"lat": -90.1, "lon": 0.0},
        {"lat": -84.9, "lon": 0.0, "search_radius_km": 0.0},
        {"lat": -84.9, "lon": 0.0, "path_segments": 0},
        {"lat": -84.9, "lon": 0.0, "unexpected": True},
    ],
)
def test_analyze_site_rejects_invalid_request_payloads(client, payload):
    response = client.post("/api/analyze-site", json=payload)
    assert response.status_code == 422


def test_haversine_distance_is_symmetric():
    forward = moon_surface_distance_km(-84.9, -35.5, -89.9, 0.0)
    reverse = moon_surface_distance_km(-89.9, 0.0, -84.9, -35.5)
    assert math.isclose(forward, reverse, abs_tol=1e-9)
