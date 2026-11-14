import { Link } from "react-router-dom";
import { usePlan } from "../../app/PlanProvider";
import { formatCoordinate } from "../../domain/coordinates";

export function ComparePage() {
  const { state, dispatch } = usePlan();
  return <section className="page"><div className="eyebrow">Compare &amp; Improve</div><h1>Compare the same mission window.</h1>
    <p className="lead">Comparison will use one UTC interval for every site. No ranking or scientific estimate is shown before real API results are requested.</p>
    <section className="panel"><h2>Comparison sites</h2>
      {state.selectedSite && !state.comparisonSites.some((site) => site.latitude_deg === state.selectedSite?.latitude_deg && site.longitude_deg === state.selectedSite?.longitude_deg) && <button onClick={() => dispatch({ type: "add-comparison-site", site: state.selectedSite! })}>Add selected location as Site A</button>}
      {state.comparisonSites.length ? <ol className="site-list">{state.comparisonSites.map((site, index) => <li key={`${site.latitude_deg}-${site.longitude_deg}`}><strong>Site {String.fromCharCode(65 + index)}</strong> {formatCoordinate(site)} <button onClick={() => dispatch({ type: "remove-comparison-site", index })}>Remove</button></li>)}</ol> : <p className="muted">Choose a location in Explore first.</p>}
      <p className="truth-note">The comparison, stress-test and other-dates requests are wired through one typed API client. Their result views are Phase 7 and 8 work.</p>
      <Link className="secondary-action" to="/explore">Choose a location</Link>
    </section>
  </section>;
}
