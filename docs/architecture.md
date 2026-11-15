# Lunar Compass architecture

## Current application boundary

The frontend is a Vite, React and TypeScript application in `Three.js/`. It has
three primary routes: Explore & Analyze, Compare & Improve, and Historical
Missions. `src/app/PlanProvider.tsx` preserves selected sites, a UTC mission
window and comparison sites in session storage while visitors navigate. The
Explore route has a focused Three.js lunar globe that turns a click on the
visible surface into the same planetocentric latitude and east-positive
longitude contract used by the backend. Its conversion is unit-tested in
`src/domain/globeCoordinates.test.ts`.

All browser network access belongs in `Three.js/src/api/`. Components must not
construct alternate astronomy or terrain calculations. The FastAPI backend is
the sole source for visibility metrics, timeline positions, terrain screening,
comparison and historical records.

The Explore page submits an explicit request to `/api/analyze` only after a
user selects a coordinate and presses its analysis button. It aborts an
in-flight request when the plan changes, validates the returned analysis
contract before display, and renders the four visibility metrics, UTC window,
hourly midpoint timeline, and backend-provided limitations. No placeholder
scientific result is displayed before a successful response.

The visibility presentation derives its sky dial and chart only from the
returned hourly `sun_*` and `earth_*` fields. The horizon ring and chart line
both mean the backend's zero-degree geometric horizon. The timeline selector
changes which returned midpoint is visualised; it never calculates an
independent Sun or Earth position in the browser.

Terrain screening is a separate, explicit request to `/api/terrain/analyze`.
It uses the selected response location and a user-selected regional radius.
The UI differentiates service failure from `terrain_available: false`, exposes
coverage and dataset warnings, and never substitutes missing terrain values or
uses terrain data to alter visibility output.

The Compare route sends two or three selected sites through `/api/compare` for
the same stored UTC window. It renders site-specific failures, backend trade-off
text, optional terrain availability, and backend provenance rather than making
a browser-side score. Mission Stress Test uses `/api/stress-test` for one
explicit variant; Other dates uses `/api/mission-windows` for the bounded
offsets -6, -3, 0, +3, +6 days. Neither result is presented as globally optimal
or as a safety prediction.

Historical Missions loads cards and detail solely from `/api/missions` and
`/api/missions/{id}`. A documented actual location can replace comparison Site
A while retaining the source's coordinate-quality note. Replay is available
only when the backend marks a record eligible and uses `/replay`; it visibly
separates historical facts from the modern simplified-horizon model.

During development, `vite.config.ts` proxies `/api` and `/health` to
`http://127.0.0.1:8000` by default. Set `LUNAR_COMPASS_API_TARGET` only for a
deliberately configured local backend. Production must route the same paths
through its reverse proxy or explicitly configured API origin.

## Scientific result policy

No frontend fallback may present a local approximation as NASA-derived data.
If `/api/analyze` fails, preserve the selected site and UTC window, report the
error and offer retry. Do not fill metric cards, timelines, terrain fields or
operational recommendations with estimates.

The retired prototype is held in `Three.js/src/legacy/` as a migration
reference. It is not imported by `main.tsx` and must not be shipped as an
alternate results interface. The production globe selects a coordinate only;
its display texture is not terrain, lighting, or scientific analysis data.

## Contract maintenance

`backend/openapi.json` is a checked-in snapshot of `create_app().openapi()`.
After intentionally changing a public backend route, run:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\export_openapi.py
```

Then update the typed frontend boundary and its tests in the same pull request.
`backend/tests/test_openapi_contract.py` rejects stale snapshots.
