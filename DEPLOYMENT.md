# Deployment: Vercel frontend + Render backend

Deploy the backend first, then deploy the frontend. Keep the backend at one
worker: the NASA request gate coordinates requests inside one process and is
not a distributed lock.

## 1. Deploy the API on Render

1. In Render, choose **New → Blueprint** and select this repository. Render
   reads `render.yaml`; accept the `lunar-compass-api` web service.
2. Enter these environment values in Render before the first deploy:

   | Variable | Value |
   | --- | --- |
   | `LUNAR_COMPASS_CONTACT` | `mnnishan04@gmail.com` or another real monitored team contact |
   | `ALLOWED_ORIGINS` | Leave temporarily blank, then set the exact Vercel URL after step 2—for example `https://your-project.vercel.app` |
   | `GROQ_API_KEY` | Optional. Enables general assistant questions; never expose it to Vercel. |

   `GROQ_MODEL` is already set to `openai/gpt-oss-20b`. Do not put any secret
   in a `VITE_*` variable.
3. After deployment, copy the public service origin, such as
   `https://lunar-compass-api.onrender.com`, and check:

   ```text
   https://YOUR-RENDER-SERVICE.onrender.com/health
   https://YOUR-RENDER-SERVICE.onrender.com/health/ready
   https://YOUR-RENDER-SERVICE.onrender.com/docs
   ```

`/health` must return `{"status":"ok"}`. `/health/ready` returns 503 until
both the contact and the local terrain rasters are available; it never makes a
NASA request itself.

### Terrain data on Render

The repo deliberately ignores the NASA LOLA GeoTIFFs (`*.tif`, `local_data/`).
This prevents a very large scientific dataset from entering Git, but means a
new Render instance has no terrain data by default. The visibility, history,
comparison, ice, and assistant APIs still run; terrain endpoints return a clear
503 and readiness reports `terrain_dataset_ready: false`.

For full terrain deployment, attach a Render persistent disk and upload the
two verified rasters described in `backend/TERRAIN_INTEGRATION.md`. Set
`LUNAR_COMPASS_TERRAIN_DATA_DIR` to the mounted directory containing
`lola_elevation.tif` and `lola_slope.tif`, then redeploy. Do not substitute
demo rasters or fabricate terrain results.

## 2. Deploy the frontend on Vercel

1. Import the same GitHub repository in Vercel. Vercel automatically uses
   `vercel.json`; the build is `npm run build` and the static output is
   `Three.js/dist`.
2. In **Project Settings → Environment Variables**, add this for Production
   (and Preview if previews should call the shared API):

   | Variable | Value |
   | --- | --- |
   | `VITE_API_BASE_URL` | The Render origin from step 1, with no trailing slash |

3. Deploy, copy the Vercel production URL, then return to Render and set
   `ALLOWED_ORIGINS` to that exact URL. For example:

   ```text
   https://your-project.vercel.app
   ```

   Multiple exact origins can be comma-separated. Wildcards are intentionally
   rejected. If you use a custom domain or preview domain, add each exact HTTPS
   origin and redeploy/restart Render after changing it.

4. Redeploy Vercel after changing `VITE_API_BASE_URL`, because Vite injects it
   into the static build. No frontend rebuild is needed for an `ALLOWED_ORIGINS`
   change, but Render must restart.

## 3. Release checks

From the browser on the Vercel site:

1. Select a site, use a UTC date and run an analysis. Confirm the response is
   from the Render service—not `localhost`.
2. Open the Exploration Assistant. Without `GROQ_API_KEY`, it must explicitly
   say it is unavailable; with a key, ask a general science question.
3. Ask a Sun/Earth question only after selecting a site and date. The response
   must use the shared NASA JPL Horizons engine, not a demo window.
4. Check `GET /health/ready`. Do not treat a 503 caused only by missing terrain
   GeoTIFFs as an astronomy failure.

The Render free tier may cold-start slowly. The frontend keeps a five-minute
timeout for real Horizons analysis, while ordinary health/status checks use
short timeouts. NASA or the optional Groq provider can still be temporarily
unavailable; Lunar Compass reports those failures rather than inventing data.
