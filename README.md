# Lunar Compass — Lunar Landing Site Navigator

Lunar Compass is a planning interface for comparing lunar sites using the
backend's NASA JPL Horizons visibility analysis, optional local LOLA terrain
screening, and source-backed historical mission records. It is a decision
support prototype, not a flight-safety or landing-certification system.

## Project layout

- [`Three.js/`](Three.js/) — Aanchal's original Vite and Three.js lunar
  interface, connected to the backend through its mission-planning panel.
- [`backend/`](backend/) — FastAPI API, NASA Horizons client, terrain service,
  historical records and offline tests.
- [`docs/architecture.md`](docs/architecture.md) — request, scientific and
  integration boundaries.

## Run locally

Use separate terminals.

```powershell
# Terminal 1: API
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
$env:LUNAR_COMPASS_CONTACT = Read-Host "Real team email or public contact URL"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

```powershell
# Terminal 2: web interface
cd Three.js
npm install
npm run dev
```

Open the local address printed by Vite (normally `http://127.0.0.1:5173`).
The frontend proxies API traffic to the backend while developing.

Before sending NASA requests, enter a real, monitored team contact. Never
commit credentials or private contact information.
The terrain endpoints additionally require their documented local LOLA raster
files; a missing raster is reported as unavailable rather than fabricated.

## Verify before a release

```powershell
# Frontend, from repository root
npm run verify

# Backend
cd backend
.\.venv\Scripts\python.exe -B -m pytest -q -p no:cacheprovider
```

The standard offline suite must pass. NASA live tests are intentionally skipped
unless network access and a real NASA application contact are available.

## Deployment notes

Serve the built frontend as static assets and route `/api` and `/health` to the
FastAPI service. Configure explicit frontend origins with `ALLOWED_ORIGINS` if
they are cross-origin. Initially deploy exactly one backend worker and one
instance: the NASA request gate is deliberately in-process and cannot
coordinate multiple workers. See [`backend/README.md`](backend/README.md) for
complete API, scientific and readiness details.
