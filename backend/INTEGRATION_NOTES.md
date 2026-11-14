# Visibility and terrain integration handoff

Repository: https://github.com/Aanchal29-dev/Lunar-Landing-Site-Navigator

Base main commit: `b67f8b76fefcb7a3e9bb5591a2bc27c3ab269a78`.
Prepared local branch: `codex/fix-visibility-terrain`.
Changes are deliberately uncommitted for team review.

## Changes

- Restored `app.__version__`, which both the API and NASA identification import.
- Mounted terrain in `app.main:app`; the old terrain entry point aliases the same
  app, so both services share CORS, validation, and startup behavior.
- Preserved legacy wrapped terrain inputs while returning signed east-positive
  longitude, ready for the visibility endpoint.
- Limited terrain radius to 5 km for HTTP and direct service calls. Projection
  domain failures and out-of-coverage points now return unavailable measurements.
- Added explicit missing/unreadable raster handling and grid-configuration checks.
- Kept Horizons requests, astronomy parsing, hourly midpoint sampling, visibility
  models, and all four metric calculations unchanged.
- Added integration regressions, explicit dependency ranges and backend CI.

Frontend code and historical/comparison modules are outside these changes.

## Verification on 2026-11-14

Verified in this folder's fresh Python 3.12 environment:

- Full offline suite with actual NASA Site01 rasters: **183 passed, 9 skipped**.
- Offline run with rasters unavailable, as in CI: **182 passed, 10 skipped**.
- Existing opt-in live NASA suite: **9 passed**.
- `pip check`: no broken requirements.
- One temporary HTTP server returned 200 for both real terrain and visibility.
  Terrain's returned location was sent directly to `/api/analyze` and succeeded.
- The 144-hour mission at latitude -85.2, longitude 32.5, starting at
  `2026-11-20T00:00:00Z` returned exactly 144 entries: first
  `2026-11-20T00:30:00Z`, last `2026-11-25T23:30:00Z`, and end
  `2026-11-26T00:00:00Z`.
- Real HTTP checks for an unprojectable pole, excessive radius and malformed
  text returned the intended 200/422 responses. The temporary server was stopped.

The GitHub Actions workflow is provided but has not run on GitHub yet. Local
checks emit dependency deprecation warnings from TestClient and Affine.

## Run locally

In PowerShell, from this checkout's `backend` directory:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --workers 1
```

Open http://127.0.0.1:8000/docs. The prepared folder has a local environment and
both NASA files in `app/local_data/lola/site01`. Neither is tracked in Git.
On another computer, create the environment, install `requirements.txt`, and
download the rasters using `TERRAIN_INTEGRATION.md`.

Set `LUNAR_COMPASS_CONTACT` to the real team email or public contact URL for live
NASA requests. Set `ALLOWED_ORIGINS` for the frontend's actual origin. These
machine-specific settings are not included in source control. Deploy one worker
and one backend instance because the NASA gate is process-local.

## Review and commit

Run these from the new checkout root (the folder containing both `backend` and
`Three.js`), not from the older source project or the backend subdirectory:

```powershell
git status
git branch --show-current
git diff --check
git add backend .github/workflows/backend-tests.yml
git diff --cached --stat
git commit -m "fix(backend): integrate visibility and terrain APIs"
git push -u origin codex/fix-visibility-terrain
```

Create a PR targeting the team's `main`. If main advances, review and integrate
those changes on this branch before merging; do not overwrite other teammates'
files to resolve conflicts.

## Scientific boundaries

Terrain measurements cover Site01 only. Terrain is connected through the shared
API and coordinate contract; it does not modify the zero-degree visibility
horizon or model terrain shadows. Elevation standard deviation is a roughness
proxy, not a landing-safety assessment. Frontend/GLB click-to-coordinate mapping
has not been verified by these backend tests.
