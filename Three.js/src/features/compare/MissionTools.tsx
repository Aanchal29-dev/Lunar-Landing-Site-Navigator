import { useEffect, useRef, useState } from "react";

import { ApiError } from "../../api/client";
import { missionWindows, stressTest } from "../../api/comparison";
import type { MissionWindowsResponse, StressTestResponse } from "../../api/types";
import type { LunarCoordinate } from "../../domain/coordinates";
import { assertMissionWindow, type MissionWindow } from "../../domain/missionWindow";
import { ProvenanceDetails } from "../../components/ProvenanceDetails";

type MissionToolsProps = { coordinate: LunarCoordinate; label: string; baseline: MissionWindow };

function delta(value: number, suffix: string): string { return `${value > 0 ? "+" : ""}${value.toFixed(Number.isInteger(value) ? 0 : 1)}${suffix}`; }
function responseDelta(values: Record<string, number>, key: string, suffix: string): string {
  const value = values[key];
  return value === undefined ? "Unavailable" : delta(value, suffix);
}

export function MissionTools({ coordinate, label, baseline }: MissionToolsProps) {
  return <section className="mission-tools" aria-labelledby="mission-tools-heading"><div className="result-heading"><div><div className="eyebrow">Bounded alternative scenarios</div><h2 id="mission-tools-heading">Mission window tools</h2></div><p className="analysis-scope">{label} · no global optimum is claimed</p></div>
    <p className="truth-note">These tools evaluate only the explicit alternate windows sent to the backend. They do not forecast terrain shadows, power, communications, or landing safety.</p>
    <div className="mission-tool-grid"><StressTestPanel coordinate={coordinate} baseline={baseline} /><WindowExplorer coordinate={coordinate} baseline={baseline} /></div>
  </section>;
}

function StressTestPanel({ coordinate, baseline }: { coordinate: LunarCoordinate; baseline: MissionWindow }) {
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const [start, setStart] = useState(baseline.start_utc);
  const [duration, setDuration] = useState(String(baseline.duration_hours));
  const [result, setResult] = useState<StressTestResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    controllerRef.current?.abort();
    requestVersion.current += 1;
    setStart(baseline.start_utc); setDuration(String(baseline.duration_hours)); setResult(null); setError(null); setLoading(false);
  }, [baseline.start_utc, baseline.duration_hours, coordinate.latitude_deg, coordinate.longitude_deg]);
  useEffect(() => () => controllerRef.current?.abort(), []);

  async function run() {
    let controller: AbortController | null = null;
    let version = requestVersion.current;
    try {
      const variant = assertMissionWindow({ start_utc: start, duration_hours: Number(duration) });
      controllerRef.current?.abort(); controller = new AbortController(); controllerRef.current = controller;
      version = ++requestVersion.current;
      setLoading(true); setError(null);
      const response = await stressTest({ latitude_deg: coordinate.latitude_deg, longitude_deg: coordinate.longitude_deg, baseline, variant }, controller.signal);
      if (!controller.signal.aborted && version === requestVersion.current) setResult(response);
    } catch (caught) { if ((!controller || !controller.signal.aborted) && version === requestVersion.current) setError(caught instanceof Error ? caught.message : "Stress test could not be completed."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }

  return <section className="tool-panel"><h3>Mission Stress Test</h3><p>Evaluate one alternate start and duration against the current baseline.</p>
    <label>Variant start (UTC)<input value={start} onChange={(event) => setStart(event.target.value)} /></label>
    <label>Variant duration (hours)<input value={duration} inputMode="numeric" onChange={(event) => setDuration(event.target.value)} /></label>
    <button className="secondary-action" disabled={loading} onClick={run}>{loading ? "Testing scenario…" : "Evaluate alternate window"}</button>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {result ? <div className="scenario-result"><h4>Variant minus baseline</h4><dl><div><dt>Sunlight</dt><dd>{responseDelta(result.deltas, "sunlight_percent_delta", "%")}</dd></div><div><dt>Earth visibility</dt><dd>{responseDelta(result.deltas, "earth_visibility_percent_delta", "%")}</dd></div><div><dt>Darkness</dt><dd>{responseDelta(result.deltas, "longest_darkness_hours_delta", " h")}</dd></div><div><dt>Earth-view gap</dt><dd>{responseDelta(result.deltas, "longest_earth_gap_hours_delta", " h")}</dd></div></dl>{result.warnings.length ? <ul>{result.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : null}<ProvenanceDetails provenance={result.provenance} /></div> : null}
  </section>;
}

function WindowExplorer({ coordinate, baseline }: { coordinate: LunarCoordinate; baseline: MissionWindow }) {
  const controllerRef = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const [priority, setPriority] = useState<"balanced" | "max_sunlight" | "min_earth_gap">("balanced");
  const [result, setResult] = useState<MissionWindowsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    controllerRef.current?.abort();
    requestVersion.current += 1;
    setResult(null); setError(null); setLoading(false);
  }, [baseline.start_utc, baseline.duration_hours, coordinate.latitude_deg, coordinate.longitude_deg]);
  useEffect(() => () => controllerRef.current?.abort(), []);
  async function run() {
    controllerRef.current?.abort(); const controller = new AbortController(); controllerRef.current = controller;
    const version = ++requestVersion.current;
    setLoading(true); setError(null);
    try { const response = await missionWindows({ ...coordinate, target_start_utc: baseline.start_utc, duration_hours: baseline.duration_hours, candidate_offsets_days: [-6, -3, 0, 3, 6], priority }, controller.signal); if (!controller.signal.aborted && version === requestVersion.current) setResult(response); }
    catch (caught) { if (!controller.signal.aborted && version === requestVersion.current) setError(caught instanceof ApiError ? caught.message : caught instanceof Error ? caught.message : "Alternative-window evaluation could not be completed."); }
    finally { if (version === requestVersion.current) setLoading(false); }
  }
  return <section className="tool-panel"><h3>Other dates</h3><p>Test the bounded set: 6 and 3 days before or after the current UTC start, plus the current window.</p>
    <label>Priority <select value={priority} onChange={(event) => setPriority(event.target.value as typeof priority)}><option value="balanced">Balanced</option><option value="max_sunlight">Maximise sunlight</option><option value="min_earth_gap">Minimise Earth-view gap</option></select></label>
    <button className="secondary-action" disabled={loading} onClick={run}>{loading ? "Evaluating dates…" : "Evaluate other dates"}</button>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    {result ? <div className="window-result"><p><strong>Selection:</strong> {result.selection_criteria}</p><p><strong>Preferred among tested:</strong> {result.preferred_window ? `${result.preferred_window.start_utc} (offset ${result.preferred_window.offset_days} days)` : "No successful candidate"}</p><table><thead><tr><th>Offset</th><th>Sunlight</th><th>Earth gap</th><th>Status</th></tr></thead><tbody>{result.evaluated_windows.map((window) => <tr key={window.offset_days}><td>{window.offset_days > 0 ? "+" : ""}{window.offset_days} days</td>{window.visibility ? <><td>{window.visibility.metrics.sunlight_percent.toFixed(1)}%</td><td>{window.visibility.metrics.longest_earth_gap_hours} h</td><td>Evaluated</td></> : <td colSpan={3}>{window.error ?? "Unavailable"}</td>}</tr>)}</tbody></table><p className="truth-note">This is not globally optimal; it compares only the listed candidate offsets.</p>{result.tradeoffs.length ? <ul>{result.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul> : null}<ProvenanceDetails provenance={result.provenance} /></div> : null}
  </section>;
}
