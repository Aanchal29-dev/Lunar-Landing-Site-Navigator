# Terrain in the shared Lunar Compass backend

The shared entry point `app.main:app` exposes both `POST /api/terrain/analyze`
and `POST /api/analyze`. The legacy `app.terrain_app:app` is an alias of the same
application, including its CORS settings, input-error handler and HTTP client
lifecycle. Run one application with one worker process.

## Install and configure

From `backend/`, create and activate a virtual environment, then install the
terrain backend and test dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
# Only needed if your rasters are outside the default app/local_data/lola/site01 folder:
$env:LUNAR_COMPASS_TERRAIN_DATA_DIR = "C:\path\to\lola\site01"
```

The configured directory must contain both NASA GSFC PGDA LOLA Site01 files:

```text
Site01_final_adj_5mpp_surf.tif
Site01_final_adj_5mpp_slp.tif
```

The rasters remain untracked local data. `LUNAR_COMPASS_TERRAIN_DATA_DIR`
can point to any directory containing both files. Without it, the service looks
under `backend/app/local_data/lola/site01`. Relative configured paths are
resolved from `backend/app/terrain_service.py`, not from the process working
directory. Both rasters must have matching CRS, transform, dimensions, and
resolution; missing files return HTTP 503.

Official downloads (about 41 MB per file):

- [Site01 elevation](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_surf.tif)
- [Site01 slope](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site01/Site01_final_adj_5mpp_slp.tif)
- [NASA product description](https://pgda.gsfc.nasa.gov/products/78)

The two files must remain ignored by Git and be provisioned on each deployment.
Unreadable files return 503. Missing CRS, incompatible grids or unsupported grid
orientation produce a clear dataset-configuration error instead of measurements.

## Test

From `backend/`, with the dataset environment variable set as above:

```powershell
.\.venv\Scripts\python.exe -m pytest -q
```

The suite includes synthetic raster coverage and the NASA Site01 coordinate
regression check against the real elevation raster.

## Run the terrain endpoint

From `backend/`, with the dataset environment variable set:

```bash
uvicorn app.main:app --workers 1
```

The API docs are at <http://127.0.0.1:8000/docs>. The request shape is:

```json
{
  "latitude_deg": -89.463158,
  "longitude_deg": -137.501985,
  "analysis_radius_m": 500
}
```

`analysis_radius_m` defaults to 500 metres; valid values are greater than zero
and at most 5,000 metres. Latitude must be -90..90. Use signed, east-positive
longitude for both endpoints. For compatibility, terrain accepts finite wrapped
longitudes such as `222.498015` or `582.498015`, and returns `-137.501985` for
both. The returned location can be passed unchanged to the visibility endpoint.

The response includes pixel elevation and slope, regional statistics, coverage,
provenance and warnings. Invalid input returns 422 with safe validation metadata;
mismatched rasters return 500. Points outside coverage or the projection domain
return 200 with `terrain_available: false`, null measurements and an explicit
`outside_raster` or `outside_projection` status.

## Connection to Nishan's visibility engine

The terrain router is already registered by the shared app factory:

```python
from app.terrain_router import router as terrain_router

app.include_router(terrain_router)
```

Both APIs are served on the same host/port with the same `ALLOWED_ORIGINS`.
Terrain does not require a NASA network request or application contact; live
visibility requires `LUNAR_COMPASS_CONTACT`. Both return the same signed
longitude convention. Terrain results do not modify the visibility horizon or
provide terrain-shadow calculations.

## Data limitations

The Site01 rasters are regional 5 m/pixel measurements, not global lunar
coverage. Coordinates outside the raster footprint have no measurements. The
resolution does not resolve sub-pixel hazards such as small rocks, slope is
not a landing-safety assessment, and elevation standard deviation is a
DEM-derived roughness proxy rather than official NASA LDRM roughness.
