import { useNavigate } from "react-router-dom";

import { usePlan } from "../../app/PlanProvider";
import { CoordinateForm } from "../../components/CoordinateForm";
import { MissionWindowForm } from "../../components/MissionWindowForm";
import { formatCoordinate } from "../../domain/coordinates";

export function ExplorePage() {
  const { state, dispatch } = usePlan();
  const navigate = useNavigate();
  return <section className="page explore-page">
    <div className="eyebrow">Explore &amp; Analyze</div>
    <h1>Choose a place on the Moon.</h1>
    <p className="lead">Set a lunar coordinate and a UTC mission window. Analysis is intentionally not run until you ask for it.</p>
    <div className="explore-grid">
      <section className="moon-stage" aria-label="Moon interaction status">
        <div className="moon-orb" aria-hidden="true" />
        <p className="stage-label">Interactive Moon extraction is the next phase.</p>
        <p>Manual coordinates already use the same canonical east-positive representation that the final globe will use.</p>
      </section>
      <section className="panel selection-panel">
        <h2>Selected lunar location</h2>
        <CoordinateForm onSelect={(coordinate) => dispatch({ type: "select-site", site: { ...coordinate, label: "Selected lunar location", source: "user" } })} />
        {state.selectedSite ? <p className="selected-value">{formatCoordinate(state.selectedSite)}</p> : <p className="muted">Choose a location to continue.</p>}
        <h2>Mission window</h2>
        <p className="muted">Default: six Earth days. All times are UTC.</p>
        <MissionWindowForm value={state.missionWindow} onChange={(window) => dispatch({ type: "set-window", window })} />
        <button className="primary-action" disabled={!state.selectedSite} onClick={() => navigate("/compare")}>Add to comparison</button>
        <p className="truth-note">Sun and Earth analysis will use NASA JPL Horizons. Until a request succeeds, this interface shows no scientific result.</p>
      </section>
    </div>
  </section>;
}
