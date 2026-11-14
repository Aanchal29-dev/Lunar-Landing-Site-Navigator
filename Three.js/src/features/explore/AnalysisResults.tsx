import type { AnalysisResponse, TimelineEntry } from "../../api/types";
import { formatCoordinate } from "../../domain/coordinates";

function percentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function hours(value: number): string {
  return `${value} ${value === 1 ? "hour" : "hours"}`;
}

function timelineStatus(entry: TimelineEntry): string {
  if (entry.sun_visible && entry.earth_visible) return "Sun + Earth visible";
  if (entry.sun_visible) return "Sun visible";
  if (entry.earth_visible) return "Earth visible";
  return "Neither visible";
}

export function AnalysisResults({ analysis }: { analysis: AnalysisResponse }) {
  const metrics = [
    ["Sunlight", percentage(analysis.metrics.sunlight_percent)],
    ["Earth visibility", percentage(analysis.metrics.earth_visibility_percent)],
    ["Longest darkness", hours(analysis.metrics.longest_darkness_hours)],
    ["Longest Earth-view gap", hours(analysis.metrics.longest_earth_gap_hours)],
  ];

  return <section className="analysis-results" aria-labelledby="analysis-results-heading">
    <div className="result-heading">
      <div>
        <div className="eyebrow">NASA JPL Horizons result</div>
        <h2 id="analysis-results-heading">Sun and Earth visibility</h2>
      </div>
      <p className="analysis-scope">{formatCoordinate(analysis.location)} · {analysis.duration_hours} hourly midpoint samples</p>
    </div>

    <dl className="metric-grid">
      {metrics.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>

    <div className="analysis-details">
      <p><strong>UTC window:</strong> {analysis.start_utc} → {analysis.end_utc}</p>
      <p><strong>Model:</strong> apparent airless angles above a {analysis.model.horizon_degrees}° geometric horizon. Terrain obstruction is not included.</p>
    </div>

    <details className="timeline-details">
      <summary>View hourly timeline ({analysis.timeline.length} samples)</summary>
      <div className="timeline-table-wrap">
        <table>
          <thead><tr><th scope="col">UTC midpoint</th><th scope="col">Sun elevation</th><th scope="col">Earth elevation</th><th scope="col">Visibility</th></tr></thead>
          <tbody>{analysis.timeline.map((entry) => <tr key={entry.sample_utc}>
            <td>{entry.sample_utc}</td>
            <td>{entry.sun_elevation_deg.toFixed(2)}°</td>
            <td>{entry.earth_elevation_deg.toFixed(2)}°</td>
            <td>{timelineStatus(entry)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>

    <details className="limitations-details">
      <summary>Scientific limitations</summary>
      <ul>{analysis.model.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul>
    </details>
  </section>;
}
