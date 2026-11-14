import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError } from "../../api/client";
import type { AnalysisResponse } from "../../api/types";
import { analyzeVisibility } from "../../api/visibility";
import { usePlan } from "../../app/PlanProvider";
import { CoordinateForm } from "../../components/CoordinateForm";
import { MissionWindowForm } from "../../components/MissionWindowForm";
import { formatCoordinate } from "../../domain/coordinates";
import { missionEndUtc } from "../../domain/missionWindow";
import { AnalysisResults } from "./AnalysisResults";
import { LunarGlobe } from "./LunarGlobe";

type StoredAnalysis = { key: string; value: AnalysisResponse };
type StoredError = { key: string; message: string };

function analysisKey(latitude_deg: number, longitude_deg: number, start_utc: string, duration_hours: number): string {
  return `${latitude_deg},${longitude_deg}|${start_utc}|${duration_hours}`;
}

export function ExplorePage() {
  const { state, dispatch } = usePlan();
  const navigate = useNavigate();
  const activeRequest = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const planKeyRef = useRef<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [storedError, setStoredError] = useState<StoredError | null>(null);
  const [storedAnalysis, setStoredAnalysis] = useState<StoredAnalysis | null>(null);
  const selectCoordinate = (coordinate: { latitude_deg: number; longitude_deg: number }) => {
    dispatch({ type: "select-site", site: { ...coordinate, label: "Selected lunar location", source: "user" } });
  };
  const currentKey = state.selectedSite
    ? analysisKey(state.selectedSite.latitude_deg, state.selectedSite.longitude_deg, state.missionWindow.start_utc, state.missionWindow.duration_hours)
    : null;
  const analysis = storedAnalysis?.key === currentKey ? storedAnalysis.value : null;
  const requestError = storedError?.key === currentKey ? storedError.message : null;

  useEffect(() => () => activeRequest.current?.abort(), []);
  useEffect(() => {
    if (planKeyRef.current !== null && planKeyRef.current !== currentKey) {
      activeRequest.current?.abort();
      activeRequest.current = null;
      requestVersion.current += 1;
      setIsLoading(false);
    }
    planKeyRef.current = currentKey;
  }, [currentKey]);

  async function requestAnalysis() {
    if (!state.selectedSite || !currentKey) return;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = ++requestVersion.current;
    setIsLoading(true);
    setStoredError(null);
    try {
      const response = await analyzeVisibility({
        latitude_deg: state.selectedSite.latitude_deg,
        longitude_deg: state.selectedSite.longitude_deg,
        start_utc: state.missionWindow.start_utc,
        duration_hours: state.missionWindow.duration_hours,
      }, controller.signal);
      if (version === requestVersion.current) setStoredAnalysis({ key: currentKey, value: response });
    } catch (error) {
      if (controller.signal.aborted || version !== requestVersion.current) return;
      const message = error instanceof ApiError ? error.message : error instanceof Error ? error.message : "The visibility request could not be completed.";
      setStoredError({ key: currentKey, message });
    } finally {
      if (version === requestVersion.current) setIsLoading(false);
    }
  }
  return <section className="page explore-page">
    <div className="eyebrow">Explore &amp; Analyze</div>
    <h1>Choose a place on the Moon.</h1>
    <p className="lead">Click a visible point on the globe or enter a coordinate manually. Set a UTC mission window, then request Sun and Earth visibility from the shared backend.</p>
    <div className="explore-grid">
      <section className="moon-stage" aria-label="Moon coordinate selection">
        <LunarGlobe selectedCoordinate={state.selectedSite} onSelect={selectCoordinate} />
      </section>
      <section className="panel selection-panel">
        <h2>Selected lunar location</h2>
        <CoordinateForm onSelect={selectCoordinate} />
        {state.selectedSite ? <p className="selected-value">{formatCoordinate(state.selectedSite)}</p> : <p className="muted">Choose a location to continue.</p>}
        <h2>Mission window</h2>
        <p className="muted">Default: six Earth days. All times are UTC.</p>
        <MissionWindowForm value={state.missionWindow} onChange={(window) => dispatch({ type: "set-window", window })} />
        <button className="primary-action" disabled={!state.selectedSite || isLoading} onClick={requestAnalysis}>{isLoading ? "Requesting NASA Horizons…" : "Analyze Sun and Earth visibility"}</button>
        {requestError ? <p className="form-error" role="alert">Analysis was not available: {requestError}</p> : null}
        <button className="secondary-action compare-action" disabled={!state.selectedSite} onClick={() => {
          if (state.selectedSite) dispatch({ type: "add-comparison-site", site: state.selectedSite });
          navigate("/compare");
        }}>Add selected site to comparison</button>
        <p className="truth-note">This request uses NASA JPL Horizons for {state.missionWindow.start_utc} → {missionEndUtc(state.missionWindow)}. Until it succeeds, this interface shows no scientific result.</p>
      </section>
    </div>
    {analysis ? <AnalysisResults analysis={analysis} /> : null}
  </section>;
}
