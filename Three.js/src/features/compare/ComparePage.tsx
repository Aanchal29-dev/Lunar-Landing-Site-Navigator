import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError } from "../../api/client";
import { compareLocations } from "../../api/comparison";
import type { CompareResponse } from "../../api/types";
import { usePlan } from "../../app/PlanProvider";
import { CoordinateForm } from "../../components/CoordinateForm";
import { formatCoordinate } from "../../domain/coordinates";
import { ComparisonResults } from "./ComparisonResults";
import { MissionTools } from "./MissionTools";

function comparisonKey(siteKey: string, start_utc: string, duration_hours: number, includeTerrain: boolean) {
  return `${siteKey}|${start_utc}|${duration_hours}|${includeTerrain}`;
}

export function ComparePage() {
  const { state, dispatch } = usePlan();
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const keyRef = useRef<string | null>(null);
  const [includeTerrain, setIncludeTerrain] = useState(false);
  const [loading, setLoading] = useState(false);
  const [storedResult, setStoredResult] = useState<{ key: string; value: CompareResponse } | null>(null);
  const [storedError, setStoredError] = useState<{ key: string; value: string } | null>(null);
  const siteKey = useMemo(() => state.comparisonSites.map((site) => `${site.latitude_deg},${site.longitude_deg}`).join(";"), [state.comparisonSites]);
  const key = comparisonKey(siteKey, state.missionWindow.start_utc, state.missionWindow.duration_hours, includeTerrain);
  const result = storedResult?.key === key ? storedResult.value : null;
  const error = storedError?.key === key ? storedError.value : null;
  const missionToolSite = state.comparisonSites[0] ?? state.selectedSite;

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (keyRef.current !== null && keyRef.current !== key) {
      controllerRef.current?.abort();
      requestVersion.current += 1;
      setLoading(false);
    }
    keyRef.current = key;
  }, [key]);

  async function runComparison() {
    if (state.comparisonSites.length < 2) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const version = ++requestVersion.current;
    setLoading(true); setStoredError(null);
    try {
      const response = await compareLocations({
        locations: state.comparisonSites.map((site, index) => ({ label: `Site ${String.fromCharCode(65 + index)}`, latitude_deg: site.latitude_deg, longitude_deg: site.longitude_deg })),
        start_utc: state.missionWindow.start_utc, duration_hours: state.missionWindow.duration_hours, include_terrain: includeTerrain,
      }, controller.signal);
      if (version === requestVersion.current) setStoredResult({ key, value: response });
    } catch (caught) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      setStoredError({ key, value: caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Comparison could not be completed." });
    } finally { if (version === requestVersion.current) setLoading(false); }
  }

  return <section className="page"><div className="eyebrow">Compare &amp; Improve</div><h1>Compare the same mission window.</h1>
    <p className="lead">Compare two or three lunar locations using the exact same UTC interval. The backend explains measured trade-offs; it does not declare a universally safe site.</p>
    <div className="compare-layout"><section className="panel"><h2>Comparison sites</h2>
      {state.selectedSite && !state.comparisonSites.some((site) => site.latitude_deg === state.selectedSite?.latitude_deg && site.longitude_deg === state.selectedSite?.longitude_deg) && state.comparisonSites.length < 3 ? <button onClick={() => dispatch({ type: "add-comparison-site", site: state.selectedSite! })}>Add current location</button> : null}
      {state.comparisonSites.length ? <ol className="site-list">{state.comparisonSites.map((site, index) => <li key={`${site.latitude_deg}-${site.longitude_deg}`}><strong>Site {String.fromCharCode(65 + index)}</strong> {formatCoordinate(site)} <button onClick={() => dispatch({ type: "remove-comparison-site", index })}>Remove</button></li>)}</ol> : <p className="muted">Choose a location in Explore first, then add another site.</p>}
      {state.comparisonSites.length < 3 ? <details className="manual-site"><summary>Add a coordinate manually</summary><CoordinateForm onSelect={(coordinate) => dispatch({ type: "add-comparison-site", site: { ...coordinate, label: "Comparison location", source: "user" } })} /></details> : null}
      <label className="check-label"><input type="checkbox" checked={includeTerrain} onChange={(event) => setIncludeTerrain(event.target.checked)} /> Include local terrain summaries when the regional raster is available</label>
      <button className="primary-action" disabled={state.comparisonSites.length < 2 || loading} onClick={runComparison}>{loading ? "Comparing locations…" : "Compare locations"}</button>
      {error ? <p className="form-error" role="alert">Comparison was not available: {error}</p> : null}
      <p className="truth-note">Window: {state.missionWindow.start_utc} · {state.missionWindow.duration_hours} hours · UTC. NASA requests are coordinated by the backend.</p>
      <Link className="secondary-action" to="/explore">Choose a location on the Moon</Link>
    </section>
    <aside className="panel comparison-help"><h2>How to read it</h2><p>Sunlight and Earth visibility use the simplified geometric horizon model. Any local terrain summary is separate coverage data, not terrain-shadow analysis.</p><p>Use the mission tools below to test a different window for one selected site.</p></aside></div>
    {result ? <ComparisonResults result={result} /> : null}
    {missionToolSite ? <MissionTools coordinate={missionToolSite} label={state.comparisonSites.length ? "Site A" : missionToolSite.label} baseline={state.missionWindow} /> : null}
  </section>;
}
