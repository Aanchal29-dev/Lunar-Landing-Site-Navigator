# Lunar Compass project knowledge

## Project overview

Lunar Compass is the team's NASA Space Apps lunar landing-site exploration
project. It combines a Three.js lunar visualization with a FastAPI backend for
visibility analysis, regional terrain measurements, water-ice reference lookup,
historical mission locations, and comparisons of candidate sites or time windows.
Its purpose is exploratory planning and comparison, not certification of a
landing or mission.

## Team repository architecture

- The browser frontend is in `Three.js/`, uses Three.js and Vite, and calls the
  backend through `Three.js/src/backend.js`. Its interactive 3D Moon view lets
  users select documented landing-site and point-of-interest markers; selected
  coordinates are passed to the frontend's analysis controls.
- The Python service is a FastAPI application exposed as `backend/app/main.py`
  (`app.main:app`). The visibility, terrain, water-ice, historical-mission and
  comparison routes are mounted in that application.
- The team backend requests sunlight and Earth ephemerides from NASA JPL
  Horizons, then calculates visibility metrics and timelines from the returned
  data. It does not substitute generated or demonstration measurements when
  NASA data are unavailable.

## Team backend capabilities and boundaries

### Sunlight and Earth visibility

`POST /api/analyze` evaluates the Sun and Earth as seen from lunar coordinates.
It reports sampled visibility percentages, longest darkness and Earth-view
gaps, and a timeline. The model uses hourly midpoint samples and a simplified
zero-degree geometric horizon. It does not include local terrain obstruction,
solar-panel output, radio-link performance, active ground-station connectivity,
finite-disc effects, or eclipse/occultation screening. Visibility is not a
guarantee of solar power, communication, or landing safety.

### NASA LOLA terrain measurements

`POST /api/terrain/analyze` reads NASA GSFC PGDA LOLA Site01 elevation and slope
rasters at regional 5 m/pixel resolution. It can return pixel elevation and
slope, regional elevation and slope statistics, coverage information, and
elevation standard deviation as a roughness proxy. The rasters cover Site01,
not the whole Moon; out-of-coverage and missing data are reported as unavailable.
The roughness value is not a rock detector, and terrain analysis does not
certify landing safety or calculate landing/crash probabilities. Terrain data
do not modify the visibility model's zero-degree horizon.

### Water-ice references

`POST /api/analyze-site` searches a local, source-backed collection of lunar
south-polar permanently shadowed region (PSR) reference locations and may return
distances and a great-circle planning line. The data describe heterogeneous
remote-sensing evidence and candidate/reference sites; they do not define
deposit boundaries, abundance, extractability, or a complete lunar ice map.
The planning line is geometric only and is not a terrain-safe rover route.

### Historical missions and comparisons

`GET /api/missions` returns source-backed historical mission summaries and
locations. Detail and replay routes provide further sourced records and can run
the visibility model at eligible historical locations. The catalog is not a
complete official event chronology; a replay is a model calculation, not a
historical measurement.

`POST /api/compare` evaluates two or three candidate locations over a shared
time window, can include available local terrain data, and reports partial
failures and visibility trade-offs. `POST /api/stress-test` compares two
explicit baseline/variant windows and their metric changes. `POST
/api/mission-windows` evaluates two to ten explicit start-date offsets. A
preferred window is best only among the supplied candidates and criteria; it
is not a global optimum or a safety result.

## Separate Streamlit chatbot

The `loki-multiverse` Streamlit application is a separate project, not the
Three.js frontend. It uses Groq for chat and a NASA NTRS-backed science RAG
assistant; it also has a local lunar activity scheduler, conversational mission
memory and follow-ups, chat history, Clear Chat, and the Current Mission
sidebar. Its advisor modules call the team backend for water-ice proximity,
historical mission locations, and a fixed demonstration Sun/Earth visibility
window. Its deterministic battery calculator uses user-provided loads and
explicitly stated illustrative assumptions. These chatbot features are not
automatically capabilities of the team's Three.js application or its FastAPI
backend. The chatbot already accesses the team's local FastAPI backend; embedding
it in the main Three.js interface is planned but not yet completed.

## Unsupported capabilities

Neither the team project nor its documented APIs currently perform active
satellite tracking, antenna sizing or link-budget design, radiation forecasting,
terrain-safe rover routing, landing-probability prediction, crash-probability
calculation, or landing-safety certification. Earth visibility is geometric
line of sight only; terrain measurements and a map planning line do not establish
that a rover can safely travel between sites. Battery and endurance calculations
belong to the separate Streamlit chatbot and are estimates, not flight-qualified
engineering recommendations.

## Local evidence reviewed

This summary is based on the team's local `README.md`,
`backend/README.md`, `backend/INTEGRATION_NOTES.md`,
`backend/TERRAIN_INTEGRATION.md`, `Three.js/package.json`,
`Three.js/src/main.js`, `Three.js/src/backend.js`, and the relevant modules under
`backend/app/` (`main.py`, visibility, terrain, water-ice, historical and
comparison routes/services/data models). No claims are based on a live backend
request.
