# Lunar Compass frontend

This Vite + React application is the browser interface for the Lunar Compass
backend. It selects lunar coordinates, requests analyses, and visualises only
the values returned by the backend; it does not reproduce astronomy or terrain
calculations in the browser.

## Local development

Start the backend first from `../backend` as documented in its README. Then:

```powershell
cd Three.js
npm install
npm run dev
```

The local Vite server proxies `/api` and `/health` to
`http://127.0.0.1:8000`. To use another deliberately configured local backend,
set `LUNAR_COMPASS_API_TARGET` before starting Vite:

```powershell
$env:LUNAR_COMPASS_API_TARGET = "http://127.0.0.1:8000"
npm run dev
```

For production, route `/api` and `/health` to the backend through the same
origin's reverse proxy, or configure an explicit API origin in the deployment.
Do not expose a development proxy as a production service.

## Quality checks

```powershell
npm run typecheck
npm test
npm run build
# or all three:
npm run verify
```

The interactive Three.js globe is loaded on demand on the Explore page, so it
does not delay the initial route shell. The build may contain a larger async
Three.js bundle by design.

## Deployment boundary

Deploy the frontend as static assets. The backend must run separately with a
real `LUNAR_COMPASS_CONTACT`, explicit CORS origins if cross-origin, reachable
terrain rasters for terrain endpoints, and **one worker process initially** so
the in-process NASA request gate remains effective. See
`../backend/README.md` for those requirements.
