# Lunar Compass architecture

## Application boundary

The browser interface in `Three.js/` is the original Vite and vanilla Three.js
Lunar Site Coordinator interface. Its 3D Moon, HUD, navigation controls,
mission-planning overlay and visual styling are preserved. It does not use a
separate React application.

The **Plan Your Mission** panel is the scientific backend boundary. It converts
the UI's latitude hemisphere and 0–360° east-positive longitude into the
backend contract, then posts:

```json
{
  "latitude_deg": -85.2,
  "longitude_deg": 32.5,
  "start_utc": "2026-11-20T00:00:00Z",
  "duration_hours": 144
}
```

to `POST /api/analyze`. The selected date becomes the UTC mission start at
`00:00:00Z`; the fixed 144-hour window produces exactly 144 hourly midpoint
samples. The interface displays the returned Sun and Earth visibility
percentages, first midpoint elevations, longest darkness, and longest
Earth-view gap. Visibility is defined by the backend as elevation strictly
greater than zero.

`Three.js/src/backend.js` is the only browser request adapter. It validates the
minimum response shape, uses a 100-second timeout suitable for the serialized
NASA request gate, and surfaces backend failures to the mission form. It does
not substitute local astronomical estimates when the backend fails.

The Site Coordinator HUD requests a one-hour visibility analysis for its chosen
point and shows the returned first midpoint Sun azimuth/elevation. The
interface's original texture, lighting and navigation exist only for visual
coordinate selection; they are not terrain, line-of-sight, or visibility
analysis.

During local development `Three.js/vite.config.js` proxies `/api` and `/health`
to `http://127.0.0.1:8000`. Production must route those paths to FastAPI through
a reverse proxy or an explicitly configured API origin.

## Scientific result policy

No frontend fallback may present local geometry, visual lighting, or terrain
texture data as NASA Horizons-derived data. A failed backend request leaves the
visibility results hidden and displays a clear error. The water-ice card is a
separate static documented-site catalogue distance; it is labelled separately
and is not a visibility-engine result.

## Release verification

Run `npm run verify` from the repository root to build the original frontend.
From `backend/`, run:

```powershell
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider
```

The backend's NASA live suite requires network access plus a real configured
application contact; no simulated result may replace it.
