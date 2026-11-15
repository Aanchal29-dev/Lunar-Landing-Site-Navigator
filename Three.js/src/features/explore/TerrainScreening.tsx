import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../api/client";
import { analyzeTerrain } from "../../api/terrain";
import type { TerrainResponse } from "../../api/types";
import type { LunarCoordinate } from "../../domain/coordinates";

type TerrainScreeningProps = { coordinate: LunarCoordinate };

function metres(value: number | null): string { return value === null ? "Not measured" : `${value.toFixed(1)} m`; }
function degrees(value: number | null): string { return value === null ? "Not measured" : `${value.toFixed(2)}°`; }

export function TerrainScreening({ coordinate }: TerrainScreeningProps) {
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const [radius, setRadius] = useState(500);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<TerrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  async function requestTerrain() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const version = ++requestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const response = await analyzeTerrain({ ...coordinate, analysis_radius_m: radius }, controller.signal);
      if (version === requestVersion.current) setResult(response);
    } catch (caught) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Terrain screening could not be completed.");
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }

  return <section className="terrain-screening" aria-labelledby="terrain-heading">
    <div className="result-heading">
      <div><div className="eyebrow">Optional local dataset screening</div><h3 id="terrain-heading">Available terrain conditions</h3></div>
      <p className="analysis-scope">Regional NASA LOLA data only</p>
    </div>
    <p className="terrain-intro">This is a separate local-raster measurement. It does not alter the 0° visibility horizon or certify a landing site.</p>
    <div className="terrain-controls">
      <label htmlFor="terrain-radius">Regional radius <select id="terrain-radius" value={radius} onChange={(event) => setRadius(Number(event.target.value))}>
        <option value={250}>250 m</option><option value={500}>500 m</option><option value={1000}>1 km</option><option value={2500}>2.5 km</option><option value={5000}>5 km</option>
      </select></label>
      <button className="secondary-action" disabled={isLoading} onClick={requestTerrain}>{isLoading ? "Checking terrain data…" : "Check available terrain data"}</button>
    </div>
    {error ? <p className="form-error" role="alert">Terrain data was not available: {error}</p> : null}
    {result ? <TerrainData result={result} /> : <p className="muted">No terrain values are shown until the configured local dataset responds.</p>}
  </section>;
}

function TerrainData({ result }: { result: TerrainResponse }) {
  if (!result.terrain_available) return <div className="terrain-unavailable">
    <h4>No terrain measurements are available for this location</h4>
    <p>Coverage status: <strong>{result.region.coverage_status}</strong>. The application does not substitute flat terrain or an estimate.</p>
    <TerrainWarnings warnings={result.warnings} />
    <p className="raster-source">Dataset: {result.raster.dataset_provenance}</p>
  </div>;

  return <div className="terrain-data">
    <dl className="metric-grid terrain-metrics">
      <div><dt>Pixel elevation</dt><dd>{metres(result.pixel.elevation_m)}</dd></div>
      <div><dt>Pixel slope</dt><dd>{degrees(result.pixel.slope_deg)}</dd></div>
      <div><dt>Mean elevation</dt><dd>{metres(result.region.mean_elevation_m)}</dd></div>
      <div><dt>Maximum slope</dt><dd>{degrees(result.region.maximum_slope_deg)}</dd></div>
    </dl>
    <p className="terrain-coverage"><strong>Coverage:</strong> {result.region.requested_area_coverage_percentage.toFixed(1)}% of the requested {result.region.analysis_radius_m.toFixed(0)} m circle · {result.region.valid_data_percentage.toFixed(1)}% valid cells · {result.region.coverage_status}</p>
    <details className="limitations-details"><summary>Terrain dataset detail and limitations</summary>
      <p>Elevation range: {metres(result.region.elevation_range_m)} · roughness proxy: {metres(result.region.elevation_stddev_m_roughness_proxy)} · raster resolution: {result.raster.resolution_m.toFixed(1)} m.</p>
      <ul>{result.raster.dataset_limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
    </details>
    <TerrainWarnings warnings={result.warnings} />
    <p className="raster-source">Dataset: <a href={result.raster.dataset_source_url} target="_blank" rel="noreferrer">{result.raster.dataset_provenance}</a></p>
  </div>;
}

function TerrainWarnings({ warnings }: { warnings: string[] }) {
  return warnings.length ? <div className="terrain-warnings"><strong>Warnings</strong><ul>{warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div> : null;
}
