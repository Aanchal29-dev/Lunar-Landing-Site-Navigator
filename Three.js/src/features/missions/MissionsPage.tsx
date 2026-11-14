import { Link, useParams } from "react-router-dom";

export function MissionsPage() {
  return <section className="page"><div className="eyebrow">Historical Missions</div><h1>Learn from documented lunar missions.</h1>
    <p className="lead">Mission data will be loaded only from the shared backend. This prevents the frontend prototype from silently replacing sourced history with hardcoded labels.</p>
    <section className="panel"><h2>Historical Explorer foundation</h2><p>Mission cards, sourced stories, modeled replay and history-to-comparison are scheduled for Phase 9.</p><Link className="secondary-action" to="/explore">Explore a location now</Link></section>
  </section>;
}

export function MissionDetailPage() {
  const { missionId } = useParams();
  return <section className="page"><div className="eyebrow">Historical Missions</div><h1>{missionId ?? "Mission"}</h1><p className="lead">This route is reserved for backend-sourced mission detail. It does not display placeholder history as fact.</p><Link className="secondary-action" to="/missions">Back to Historical Missions</Link></section>;
}
