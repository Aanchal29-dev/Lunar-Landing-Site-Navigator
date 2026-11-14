import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import { usePlan } from "../app/PlanProvider";
import { formatCoordinate } from "../domain/coordinates";
import { missionEndUtc } from "../domain/missionWindow";

export function AppShell({ children }: { children: ReactNode }) {
  const { state } = usePlan();
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink className="brand" to="/explore" aria-label="Lunar Compass home">Lunar <span>Compass</span></NavLink>
        <nav aria-label="Primary navigation">
          <NavLink to="/explore">Explore &amp; Analyze</NavLink>
          <NavLink to="/compare">Compare &amp; Improve</NavLink>
          <NavLink to="/missions">Historical Missions</NavLink>
        </nav>
        <details className="methods-drawer">
          <summary>Data &amp; Methods</summary>
          <p>Results come from the shared backend. The current visibility model uses hourly midpoint samples and a simplified 0° horizon; it is not a landing-safety certification.</p>
        </details>
      </header>
      <main>{children}</main>
      <aside className="context-strip" aria-label="Current plan">
        <span>Current plan</span>
        <strong>{state.selectedSite ? formatCoordinate(state.selectedSite) : "No location selected"}</strong>
        <span>{state.missionWindow.start_utc} → {missionEndUtc(state.missionWindow)} · {state.missionWindow.duration_hours} h · UTC</span>
      </aside>
    </div>
  );
}
