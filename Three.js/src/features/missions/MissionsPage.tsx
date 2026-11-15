import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { ApiError } from "../../api/client";
import { getMission, listMissions, replayMission } from "../../api/missions";
import type { HistoricalReplayResponse, MissionDetail, MissionSummary } from "../../api/types";
import { usePlan } from "../../app/PlanProvider";
import { assertCoordinate, formatCoordinate } from "../../domain/coordinates";
import { AnalysisResults } from "../explore/AnalysisResults";

function errorText(caught: unknown): string { return caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "The historical record could not be loaded."; }

export function MissionsPage() {
  const controllerRef = useRef<AbortController | null>(null);
  const [missions, setMissions] = useState<MissionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController(); controllerRef.current = controller;
    listMissions(controller.signal).then((response) => { if (!controller.signal.aborted) setMissions(response); }).catch((caught) => { if (!controller.signal.aborted) setError(errorText(caught)); });
    return () => controller.abort();
  }, []);
  return <section className="page"><div className="eyebrow">Historical Missions</div><h1>Learn from documented lunar missions.</h1>
    <p className="lead">These records come from the backend’s verified dataset. Historical facts and a modern geometric-horizon replay are shown separately.</p>
    {error ? <p className="form-error" role="alert">Mission records were not available: {error}</p> : null}
    {!missions && !error ? <p className="muted">Loading source-backed mission records…</p> : null}
    {missions ? <div className="mission-card-grid">{missions.map((mission) => <article className="mission-card" key={mission.id}><div className="eyebrow">{mission.country} · {mission.landing_outcome}</div><h2>{mission.name}</h2><p>{mission.event_time_utc} · {mission.time_precision}</p><p>{mission.replay.status === "ineligible" ? "Modeled replay is not available for this record." : `Replay uses ${mission.replay.label}.`}</p><Link className="secondary-action" to={`/missions/${encodeURIComponent(mission.id)}`}>Read documented record</Link></article>)}</div> : null}
  </section>;
}

export function MissionDetailPage() {
  const { missionId } = useParams();
  const navigate = useNavigate();
  const { state, dispatch } = usePlan();
  const controllerRef = useRef<AbortController | null>(null);
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState<HistoricalReplayResponse | null>(null);
  const [replayError, setReplayError] = useState<string | null>(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [duration, setDuration] = useState(String(state.missionWindow.duration_hours));
  useEffect(() => {
    if (!missionId) return;
    const controller = new AbortController(); controllerRef.current = controller;
    setMission(null); setReplay(null); setError(null);
    getMission(missionId, controller.signal).then((response) => { if (!controller.signal.aborted) setMission(response); }).catch((caught) => { if (!controller.signal.aborted) setError(errorText(caught)); });
    return () => controller.abort();
  }, [missionId]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  function useAsSiteA() {
    if (!mission) return;
    const coordinate = assertCoordinate(mission.actual_location);
    const site = { ...coordinate, label: mission.name, source: "historical" as const, sourceNote: `${mission.actual_location.location_type}; ${mission.actual_location.coordinate_quality}.` };
    dispatch({ type: "select-site", site });
    dispatch({ type: "set-comparison-sites", sites: [site] });
    navigate("/compare");
  }
  async function runReplay() {
    if (!missionId) return;
    const requestedDuration = Number(duration);
    if (!Number.isInteger(requestedDuration) || requestedDuration < 1 || requestedDuration > 336) { setReplayError("Replay duration must be a whole number from 1 to 336 hours."); return; }
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller;
    setReplayLoading(true); setReplayError(null);
    try { const response = await replayMission(missionId, requestedDuration, controller.signal); if (!controller.signal.aborted) setReplay(response); }
    catch (caught) { if (!controller.signal.aborted) setReplayError(errorText(caught)); }
    finally { if (!controller.signal.aborted) setReplayLoading(false); }
  }

  if (error) return <section className="page"><p className="form-error" role="alert">Mission record was not available: {error}</p><Link className="secondary-action" to="/missions">Back to missions</Link></section>;
  if (!mission) return <section className="page"><p className="muted">Loading documented mission record…</p></section>;
  const actual = assertCoordinate(mission.actual_location);
  return <section className="page mission-detail"><Link to="/missions">← All missions</Link><div className="eyebrow">Documented historical record</div><h1>{mission.name}</h1>
    <p className="lead">{mission.event_description}</p>
    <div className="mission-detail-grid"><section className="panel"><h2>What happened</h2><p>{mission.what_happened}</p><h3>Objective</h3><p>{mission.mission_objective}</p><h3>Outcome</h3><p>{mission.overall_mission_outcome}</p>{mission.documented_failure_reason ? <><h3>Documented failure reason</h3><p>{mission.documented_failure_reason}</p></> : null}<h3>Achievements</h3><p>{mission.achievements}</p></section>
    <section className="panel"><h2>Documented locations</h2><LocationRecord title="Actual location" location={mission.actual_location} /><LocationRecord title="Intended location" location={mission.intended_location} /><button className="primary-action" onClick={useAsSiteA}>Use actual location as comparison Site A</button><p className="truth-note">This preserves the source’s location type and coordinate quality. Choose a new point as Site B in Explore, then compare the same window.</p></section></div>
    <section className="replay-panel"><div className="result-heading"><div><div className="eyebrow">Modeled replay</div><h2>Recreate visibility conditions around this event</h2></div><p className="analysis-scope">Historical fact ≠ modeled cause</p></div>
      <p>The replay uses {mission.replay.label}. It models modern simplified geometric Sun/Earth visibility around the documented event time; it does not explain or assign causes for the mission outcome.</p>
      {mission.replay.status === "ineligible" ? <p className="muted">This record is not eligible for replay: {mission.replay.label}.</p> : <><label>Replay duration (hours)<input value={duration} inputMode="numeric" onChange={(event) => setDuration(event.target.value)} /></label><button className="secondary-action" disabled={replayLoading} onClick={runReplay}>{replayLoading ? "Running replay…" : "Run modeled replay"}</button></>}
      {replayError ? <p className="form-error" role="alert">Replay was not available: {replayError}</p> : null}
    </section>
    {replay ? <><section className="historical-context"><p><strong>Replayed site:</strong> {replay.historical_context.location_label} · {replay.historical_context.location_type} · coordinate quality: {replay.historical_context.coordinate_quality}</p><p>Modeled coordinate: {formatCoordinate(actual)}</p></section><AnalysisResults analysis={replay.analysis} /></> : null}
    <section className="sources-panel"><h2>Sources</h2><ul>{mission.sources.map((source) => <li key={source.key}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> — {source.supports}</li>)}</ul></section>
  </section>;
}

function LocationRecord({ title, location }: { title: string; location: MissionDetail["actual_location"] }) {
  const coordinate = assertCoordinate(location);
  return <div className="location-record"><h3>{title}</h3><p>{location.name} · {formatCoordinate(coordinate)}</p><p>{location.location_type} · coordinate quality: {location.coordinate_quality}</p><p>{location.precision_or_uncertainty}</p><p className="muted">Source notation: {location.original_coordinate_text}</p></div>;
}
