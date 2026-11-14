# Lunar Compass architecture

## Current application boundary

The frontend is a Vite, React and TypeScript application in `Three.js/`. It has
three primary routes: Explore & Analyze, Compare & Improve, and Historical
Missions. `src/app/PlanProvider.tsx` preserves selected sites, a UTC mission
window and comparison sites in session storage while visitors navigate.

All browser network access belongs in `Three.js/src/api/`. Components must not
construct alternate astronomy or terrain calculations. The FastAPI backend is
the sole source for visibility metrics, timeline positions, terrain screening,
comparison and historical records.

During development, `vite.config.ts` proxies `/api` and `/health` to
`http://127.0.0.1:8000` by default. Set `LUNAR_COMPASS_API_TARGET` only for a
deliberately configured local backend. Production must route the same paths
through its reverse proxy or explicitly configured API origin.

## Scientific result policy

No frontend fallback may present a local approximation as NASA-derived data.
If `/api/analyze` fails, preserve the selected site and UTC window, report the
error and offer retry. Do not fill metric cards, timelines, terrain fields or
operational recommendations with estimates.

The retired prototype is held in `Three.js/src/legacy/` for extracting camera,
marker and map interaction code in Phase 3. It is not imported by `main.tsx`.
It must not be shipped as an alternate results interface.

## Contract maintenance

`backend/openapi.json` is a checked-in snapshot of `create_app().openapi()`.
After intentionally changing a public backend route, run:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\export_openapi.py
```

Then update the typed frontend boundary and its tests in the same pull request.
`backend/tests/test_openapi_contract.py` rejects stale snapshots.
