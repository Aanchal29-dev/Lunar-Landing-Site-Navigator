import numpy as np
import math
import json
import pytest
import rasterio
from rasterio.warp import transform
from fastapi.testclient import TestClient
from fastapi import FastAPI

from app import terrain_router as terrain_router_module
from app.terrain_app import app
from app.main import create_app, app as shared_app
from app.models import AnalysisRequest
from app.terrain_service import (DatasetMismatchError, TerrainService, LUNAR_GEOGRAPHIC_CRS,
                                 ELEVATION_FILENAME, SLOPE_FILENAME, DATA_DIR_ENV_VAR,
                                 MOON_RADIUS_M)

@pytest.fixture
def rasters(tmp_path):
    # Synthetic lunar stereographic grid around the documented in-coverage lookup.
    import rasterio.warp
    x, y = rasterio.warp.transform(LUNAR_GEOGRAPHIC_CRS, rasterio.crs.CRS.from_proj4(
        "+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a=1737400 +b=1737400 +units=m +no_defs"),
        [222.498015], [-89.463158])
    crs = rasterio.crs.CRS.from_proj4("+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a=1737400 +b=1737400 +units=m +no_defs")
    # Construct coefficient tuple directly so the fixture does not depend on
    # affine's convenience arithmetic (rasterio pins compatible versions).
    transform = (5, 0, x[0]-50, 0, -5, y[0]+50)
    dem = np.full((20,20), 1944.77, dtype="float32")
    slope = np.full((20,20), 3.8, dtype="float32")
    dem[0,0] = -9999
    for name, array in ((ELEVATION_FILENAME, dem), (SLOPE_FILENAME, slope)):
        with rasterio.open(tmp_path/name, "w", driver="GTiff", height=20, width=20,
                           count=1, dtype="float32", crs=crs, transform=transform, nodata=-9999) as dst:
            dst.write(array, 1)
    return tmp_path

def test_in_coverage_point_and_metrics(rasters):
    out = TerrainService(rasters).analyze(-89.463158, 222.498015, 20)
    assert out["pixel"]["elevation_m"] == pytest.approx(1944.77, abs=.02)
    assert out["pixel"]["slope_deg"] == pytest.approx(3.8, abs=.01)
    assert out["region"]["valid_pixel_count"] > 0
    assert "elevation_stddev_m_roughness_proxy" in out["region"]

def test_out_of_coverage_point(rasters):
    out = TerrainService(rasters).analyze(0, 0)
    assert out["region"]["coverage_status"] == "outside_raster"
    assert out["pixel"]["row"] is None and out["pixel"]["column"] is None
    assert out["terrain_available"] is False

def test_invalid_inputs(rasters):
    with pytest.raises(ValueError): TerrainService(rasters).analyze(91, 0)
    with pytest.raises(ValueError): TerrainService(rasters).analyze(0, float("nan"))
    with pytest.raises(ValueError): TerrainService(rasters).analyze(0, 0, 0)

def test_missing_pixels_and_valid_count(rasters):
    out = TerrainService(rasters).analyze(-89.463158, 222.498015, 75)
    assert out["region"]["valid_pixel_count"] < out["region"]["total_pixel_count"]
    assert out["region"]["valid_pixel_percentage"] < 100
    assert out["region"]["valid_data_percentage"] == out["region"]["valid_pixel_percentage"]

def test_missing_selected_pixel_marks_terrain_unavailable(rasters):
    with rasterio.open(rasters / ELEVATION_FILENAME) as ds:
        x, y = ds.xy(0, 0)
        lon, lat = rasterio.warp.transform(ds.crs, LUNAR_GEOGRAPHIC_CRS, [x], [y])
    out = TerrainService(rasters).analyze(lat[0], lon[0], 10)
    assert out["terrain_available"] is False
    assert out["pixel"]["elevation_m"] is None

def test_radius_clipping(rasters):
    out = TerrainService(rasters).analyze(-89.463158, 222.498015, 1000)
    assert out["region"]["coverage_status"] == "edge_clipped"
    assert 0 < out["region"]["requested_area_coverage_percentage"] < 100
    assert out["region"]["valid_pixel_percentage"] < 100
    assert out["region"]["valid_pixel_percentage"] != out["region"]["requested_area_coverage_percentage"]
    assert any("clipped" in w for w in out["warnings"])

def test_rasters_must_share_grid(rasters):
    with rasterio.open(rasters / SLOPE_FILENAME, "r+") as dataset:
        dataset.transform = dataset.transform * rasterio.Affine.translation(1, 0)
    with pytest.raises(DatasetMismatchError, match="transform"):
        TerrainService(rasters).analyze(-89.463158, 222.498015)

def test_dataset_directory_configurable_independent_of_cwd(rasters, monkeypatch, tmp_path):
    monkeypatch.setenv(DATA_DIR_ENV_VAR, str(rasters))
    monkeypatch.chdir(tmp_path)
    service = TerrainService()
    assert service.data_dir == rasters.resolve()
    assert service.analyze(-89.463158, 222.498015, 20)["terrain_available"] is True

def test_nasa_site01_coordinate_matches_raster_centre():
    """Cross-check NASA's rounded Site01 coordinate against the PGDA raster centre.

    NASA M2M-30044 Lunar Surface Data Book (March 2025), p. 75, lists
    Site01/Connecting Ridge at -89.4632°, -137.49°; -137.49° west is
    222.51° east. NASA notes these polygon centres were generated from the
    PGDA DEM, so this is a useful cross-check, not wholly independent validation.
    """
    dem_path = TerrainService().elevation_path
    if not dem_path.is_file():
        pytest.skip("Local NASA Site01 elevation raster is not installed")

    reference_latitude = -89.4632
    reference_longitude_east = 222.51
    normalized_longitude = reference_longitude_east % 360.0
    assert normalized_longitude == pytest.approx(222.51)

    with rasterio.open(dem_path) as dem:
        # rasterio.warp.transform takes x=longitude, y=latitude, in that order.
        projected_x, projected_y = transform(
            LUNAR_GEOGRAPHIC_CRS, dem.crs,
            [normalized_longitude], [reference_latitude],
        )
        assert np.isfinite(projected_x[0]) and np.isfinite(projected_y[0])
        assert dem.index(projected_x[0], projected_y[0]) == (1599, 1600)

        center_x, center_y = dem.xy(1600, 1600)
        center_longitude, center_latitude = transform(
            dem.crs, LUNAR_GEOGRAPHIC_CRS, [center_x], [center_y],
        )

        # Spherical haversine distance using the raster's lunar reference radius.
        lat1, lat2 = map(math.radians, (reference_latitude, center_latitude[0]))
        delta_lat = lat2 - lat1
        delta_lon = math.radians(center_longitude[0] - normalized_longitude)
        hav = (math.sin(delta_lat / 2) ** 2
               + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2)
        separation_m = 2 * MOON_RADIUS_M * math.asin(math.sqrt(hav))

    # The longitude convention/normalization used by the API must preserve the same pixel.
    normalized_result = TerrainService().analyze(
        reference_latitude, reference_longitude_east + 360.0, analysis_radius_m=5
    )
    assert normalized_result["location"]["longitude_deg"] == pytest.approx(normalized_longitude - 360)
    assert normalized_result["pixel"]["column"] == 1600
    assert separation_m < 10.0

    # Reversing the input axes would place the latitude in the invalid latitude slot.
    with pytest.raises(Exception):
        transform(LUNAR_GEOGRAPHIC_CRS, dem.crs,
                  [reference_latitude], [normalized_longitude])

def test_api_contract(rasters, monkeypatch):
    monkeypatch.setattr(terrain_router_module, "service", TerrainService(rasters))
    # Integrators create their own app and mount only the APIRouter.
    shared_app = FastAPI()
    shared_app.include_router(terrain_router_module.router)
    client = TestClient(shared_app)
    response = client.post("/api/terrain/analyze", json={"latitude_deg":-89.463158,"longitude_deg":222.498015})
    assert response.status_code == 200
    body = response.json()
    assert set(("terrain_available", "location", "pixel", "region", "raster", "warnings")) <= set(body)
    assert body["terrain_available"] is True
    assert body["raster"]["dataset_source_url"].startswith("https://")
    assert "requested_area_coverage_percentage" in body["region"]
    assert "not official NASA LDRM" in " ".join(body["warnings"])
    assert body["region"]["analysis_radius_m"] == 500
    assert client.post("/api/terrain/analyze", json={"latitude_deg":91,"longitude_deg":0}).status_code == 422
    standalone_client = TestClient(app)
    assert standalone_client.post("/api/terrain/analyze", json={
        "latitude_deg":-89.463158, "longitude_deg":222.498015
    }).status_code == 200


def test_legacy_entrypoint_reuses_shared_application():
    assert app is shared_app


def test_shared_api_exposes_both_services_and_cors(rasters, monkeypatch):
    monkeypatch.setattr(terrain_router_module, "service", TerrainService(rasters))
    monkeypatch.setenv("ALLOWED_ORIGINS", "http://localhost:5173")
    with TestClient(create_app()) as client:
        paths = client.get("/openapi.json").json()["paths"]
        assert {"/api/analyze", "/api/terrain/analyze", "/health"} <= paths.keys()
        assert client.get("/health").json() == {"status": "ok"}
        preflight = client.options("/api/terrain/analyze", headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "Content-Type",
        })
        assert preflight.status_code == 200
        assert preflight.headers["access-control-allow-origin"] == "http://localhost:5173"
        response = client.post("/api/terrain/analyze", json={
            "latitude_deg": -89.463158, "longitude_deg": 222.498015,
        })
        assert response.status_code == 200
        assert response.json()["terrain_available"] is True
        location = response.json()["location"]
        assert location["longitude_deg"] == pytest.approx(-137.501985)
        # A terrain result must be reusable by the visibility API without client conversion.
        visibility_request = AnalysisRequest(
            **location, start_utc="2026-11-20T00:00:00Z", duration_hours=144
        )
        assert visibility_request.longitude_deg == location["longitude_deg"]


@pytest.mark.parametrize("longitude", [-137.501985, 222.498015, 582.498015])
def test_equivalent_longitudes_return_same_pixel_and_signed_location(rasters, longitude):
    result = TerrainService(rasters).analyze(-89.463158, longitude, 20)
    assert result["location"]["longitude_deg"] == pytest.approx(-137.501985)
    assert result["pixel"]["row"] == 10
    assert result["pixel"]["column"] == 10


@pytest.mark.parametrize("latitude", [90, 89.999999, 0])
def test_outside_projection_and_coverage_are_not_server_errors(rasters, monkeypatch, latitude):
    monkeypatch.setattr(terrain_router_module, "service", TerrainService(rasters))
    with TestClient(create_app()) as client:
        response = client.post("/api/terrain/analyze", json={"latitude_deg": latitude, "longitude_deg": 0})
    assert response.status_code == 200
    result = response.json()
    assert result["terrain_available"] is False
    assert result["region"]["coverage_status"] == ("outside_projection" if latitude == 90 else "outside_raster")
    assert result["pixel"] == {"row": None, "column": None, "elevation_m": None, "slope_deg": None}


@pytest.mark.parametrize("field,value", [
    ("analysis_radius_m", 1e200), ("analysis_radius_m", 5000.001),
    ("analysis_radius_m", 0), ("analysis_radius_m", True),
    ("latitude_deg", True), ("longitude_deg", "32.5"),
])
def test_terrain_api_and_direct_callers_reject_invalid_input(rasters, monkeypatch, field, value):
    service = TerrainService(rasters)
    monkeypatch.setattr(terrain_router_module, "service", service)
    payload = {"latitude_deg": -89.463158, "longitude_deg": 222.498015, field: value}
    with TestClient(create_app()) as client:
        response = client.post("/api/terrain/analyze", json=payload)
    assert response.status_code == 422
    assert isinstance(response.json()["detail"], list)
    with pytest.raises(ValueError):
        service.analyze(**payload)


def test_maximum_radius_is_supported(rasters):
    assert TerrainService(rasters).analyze(-89.463158, 222.498015, 5000)["terrain_available"]


@pytest.mark.parametrize("content,content_type", [
    (b"\xff", "text/plain"),
    (json.dumps({"latitude_deg": -89.463158, "longitude_deg": 222.498015, "\ud800": "private"}), "application/json"),
    (json.dumps({"latitude_deg": "\ud800", "longitude_deg": 0}), "application/json"),
])
def test_terrain_uses_safe_shared_validation(content, content_type):
    with TestClient(create_app()) as client:
        response = client.post("/api/terrain/analyze", content=content, headers={"Content-Type": content_type})
    assert response.status_code == 422
    assert "private" not in response.text
    response.content.decode("utf-8", errors="strict")
    for error in response.json()["detail"]:
        assert set(error) == {"type", "loc", "msg"}


@pytest.mark.parametrize("corrupt", [False, True])
def test_missing_or_unreadable_datasets_return_safe_503(tmp_path, monkeypatch, corrupt):
    if corrupt:
        for filename in (ELEVATION_FILENAME, SLOPE_FILENAME):
            (tmp_path / filename).write_bytes(b"not a GeoTIFF")
    monkeypatch.setattr(terrain_router_module, "service", TerrainService(tmp_path))
    with TestClient(create_app()) as client:
        response = client.post("/api/terrain/analyze", json={"latitude_deg": 0, "longitude_deg": 0})
    assert response.status_code == 503
    assert isinstance(response.json()["detail"], str)
    assert str(tmp_path) not in response.text


def test_missing_crs_is_reported_as_dataset_configuration_error(rasters):
    with rasterio.open(rasters / ELEVATION_FILENAME) as src:
        data, profile = src.read(), src.profile
    profile.pop("crs")
    with rasterio.open(rasters / ELEVATION_FILENAME, "w", **profile) as dst:
        dst.write(data)
    with pytest.raises(DatasetMismatchError, match="reference system"):
        TerrainService(rasters).analyze(-89.463158, 222.498015)


def test_terrain_programming_errors_are_not_hidden(monkeypatch):
    def broken(**kwargs):
        raise RuntimeError("test-only programming failure")

    monkeypatch.setattr(terrain_router_module.service, "analyze", broken)
    with TestClient(create_app(), raise_server_exceptions=False) as client:
        response = client.post("/api/terrain/analyze", json={"latitude_deg": 0, "longitude_deg": 0})
    assert response.status_code == 500
    assert "test-only" not in response.text
