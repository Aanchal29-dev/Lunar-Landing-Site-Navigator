# Lunar Terrain Analysis Backend

This directory contains the terrain analysis service, its `POST /api/terrain/analyze`
router, a terrain-only FastAPI application, and the terrain tests. The application
entry point is `app.terrain_app:app`; it does not use or create `app/main.py`.

## Install and configure

From `backend/`, create and activate a virtual environment, then install the
terrain backend and test dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
export LUNAR_COMPASS_TERRAIN_DATA_DIR="/Users/yuthikasharma/lunar-terrain-analysis/local_data/lola/site01"
```

The configured directory must contain both NASA GSFC PGDA LOLA Site01 files:

```text
Site01_final_adj_5mpp_surf.tif
Site01_final_adj_5mpp_slp.tif
```

The rasters remain outside this repository. `LUNAR_COMPASS_TERRAIN_DATA_DIR`
can point to any directory containing both files. Without it, the service looks
under `backend/app/local_data/lola/site01`. Relative configured paths are
resolved from `backend/app/terrain_service.py`, not from the process working
directory. Both rasters must have matching CRS, transform, dimensions, and
resolution; missing files return HTTP 503.

## Test

From `backend/`, with the dataset environment variable set as above:

```bash
python -m pytest -q
```

The suite includes synthetic raster coverage and the NASA Site01 coordinate
regression check against the real elevation raster.

## Run the terrain endpoint

From `backend/`, with the dataset environment variable set:

```bash
uvicorn app.terrain_app:app --reload
```

The API docs are at <http://127.0.0.1:8000/docs>. The request shape is:

```json
{
  "latitude_deg": -89.463158,
  "longitude_deg": 222.498015,
  "analysis_radius_m": 500
}
```

`analysis_radius_m` defaults to 500. The response includes normalized
coordinates, pixel elevation and slope, regional statistics, data coverage,
raster provenance and limitations, and warnings. Invalid input returns HTTP
422; mismatched rasters return HTTP 500.

## Integrate with Nishan's backend

Keep this package's router and service imports under the `app` package. In
Nishan's full backend application, register the existing router on the shared
FastAPI instance:

```python
from app.terrain_router import router as terrain_router

app.include_router(terrain_router)
```

Install the dependencies from this file in the shared backend environment and
set `LUNAR_COMPASS_TERRAIN_DATA_DIR` for its process. The terrain-only app is
useful for standalone development; the shared application should mount the
router into its own FastAPI app and retain its own entry point, middleware,
lifespan, and other routes.

## Data limitations

The Site01 rasters are regional 5 m/pixel measurements, not global lunar
coverage. Coordinates outside the raster footprint have no measurements. The
resolution does not resolve sub-pixel hazards such as small rocks, slope is
not a landing-safety assessment, and elevation standard deviation is a
DEM-derived roughness proxy rather than official NASA LDRM roughness.
