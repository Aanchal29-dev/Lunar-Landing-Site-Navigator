import type { CompareResponse } from "../../api/types";
import { ProvenanceDetails } from "../../components/ProvenanceDetails";

function metric(value: number): string { return `${value.toFixed(1)}%`; }

export function ComparisonResults({ result }: { result: CompareResponse }) {
  return <section className="comparison-results" aria-labelledby="comparison-results-heading">
    <div className="result-heading"><div><div className="eyebrow">Same UTC mission window</div><h2 id="comparison-results-heading">Location trade-offs</h2></div><p className="analysis-scope">{result.start_utc} · {result.duration_hours} hours</p></div>
    <div className="comparison-table-wrap"><table>
      <thead><tr><th scope="col">Site</th><th scope="col">Sunlight</th><th scope="col">Earth visibility</th><th scope="col">Longest darkness</th><th scope="col">Longest Earth-view gap</th><th scope="col">Terrain</th></tr></thead>
      <tbody>{result.results.map((site) => {
        const terrainLabel = site.terrain === null ? "Not requested" : site.terrain_available ? "Available" : "Unavailable";
        return <tr key={`${site.label}-${site.latitude_deg}-${site.longitude_deg}`}><th scope="row">{site.label}</th>{site.status === "ok" && site.visibility ? <>
          <td>{metric(site.visibility.metrics.sunlight_percent)}</td><td>{metric(site.visibility.metrics.earth_visibility_percent)}</td><td>{site.visibility.metrics.longest_darkness_hours} h</td><td>{site.visibility.metrics.longest_earth_gap_hours} h</td><td>{terrainLabel}</td>
        </> : <td colSpan={5} className="comparison-error">Could not compare: {site.error ?? "Unknown backend error"}</td>}</tr>;
      })}</tbody>
    </table></div>
    <div className="tradeoffs"><h3>Backend-reported trade-offs</h3>{result.tradeoffs.length ? <ul>{result.tradeoffs.map((tradeoff) => <li key={tradeoff}>{tradeoff}</li>)}</ul> : <p>No trade-off summary was returned.</p>}</div>
    <p className="truth-note">This is a bounded comparison of the requested window, not a universal site ranking or landing-safety determination.</p>
    <ProvenanceDetails provenance={result.provenance} />
  </section>;
}
