import type { TimelineEntry } from "../../api/types";
import { chartX, chartY, elevationDomain, horizonPoint } from "./timelineView";

type VisibilityExplorerProps = {
  timeline: TimelineEntry[];
  selectedIndex: number;
  onSelectIndex: (index: number) => void;
};

function visibleLabel(visible: boolean): string {
  return visible ? "above the geometric horizon" : "below the geometric horizon";
}

function coordinateLine(entries: TimelineEntry[], key: "sun_elevation_deg" | "earth_elevation_deg", domain: ReturnType<typeof elevationDomain>) {
  return entries.map((entry, index) => `${chartX(index, entries.length)},${chartY(entry[key], domain)}`).join(" ");
}

export function VisibilityExplorer({ timeline, selectedIndex, onSelectIndex }: VisibilityExplorerProps) {
  const sample = timeline[selectedIndex];
  if (!sample) return null;
  const sun = horizonPoint(sample.sun_azimuth_deg, sample.sun_elevation_deg);
  const earth = horizonPoint(sample.earth_azimuth_deg, sample.earth_elevation_deg);
  const domain = elevationDomain(timeline);
  const horizonY = chartY(0, domain);
  const cursorX = chartX(selectedIndex, timeline.length);

  return <section className="visibility-explorer" aria-labelledby="visibility-explorer-heading">
    <div className="result-heading">
      <div>
        <div className="eyebrow">One verified midpoint at a time</div>
        <h3 id="visibility-explorer-heading">Sun and Earth at the local horizon</h3>
      </div>
      <p className="analysis-scope">{sample.sample_utc} UTC</p>
    </div>

    <div className="sky-and-sample">
      <div className="sky-dial-wrap">
        <svg className="sky-dial" viewBox="0 0 240 240" role="img" aria-label="North-up sky dial showing returned Sun and Earth positions relative to the zero-degree horizon">
          <circle cx="120" cy="120" r="78" className="horizon-ring" />
          <circle cx="120" cy="120" r="1.5" className="zenith-dot" />
          <text x="120" y="28" textAnchor="middle">N</text><text x="218" y="124" textAnchor="middle">E</text>
          <text x="120" y="228" textAnchor="middle">S</text><text x="22" y="124" textAnchor="middle">W</text>
          <line x1="120" y1="42" x2="120" y2="198" className="dial-axis" /><line x1="42" y1="120" x2="198" y2="120" className="dial-axis" />
          <g className={sun.belowHorizon ? "sky-object below" : "sky-object"}><circle cx={sun.x} cy={sun.y} r="7" /><text x={sun.x} y={sun.y + 3} textAnchor="middle">S</text></g>
          <g className={earth.belowHorizon ? "sky-object earth below" : "sky-object earth"}><circle cx={earth.x} cy={earth.y} r="7" /><text x={earth.x} y={earth.y + 3} textAnchor="middle">E</text></g>
        </svg>
        <p className="sky-key"><span className="sun-key" /> Sun <span className="earth-key" /> Earth · ring = 0° horizon</p>
      </div>
      <dl className="sample-readout">
        <div><dt>Sun</dt><dd>{sample.sun_elevation_deg.toFixed(2)}° elevation · {sample.sun_azimuth_deg.toFixed(2)}° azimuth</dd><small>{visibleLabel(sample.sun_visible)}</small></div>
        <div><dt>Earth</dt><dd>{sample.earth_elevation_deg.toFixed(2)}° elevation · {sample.earth_azimuth_deg.toFixed(2)}° azimuth</dd><small>{visibleLabel(sample.earth_visible)}</small></div>
      </dl>
    </div>

    <div className="timeline-chart-wrap">
      <svg className="elevation-chart" viewBox="0 0 920 240" role="img" aria-label="Sun and Earth elevation across the requested mission window">
        <line x1="50" x2="870" y1={horizonY} y2={horizonY} className="horizon-line" />
        <text x="4" y={horizonY + 4} className="chart-label">0°</text>
        <polyline points={coordinateLine(timeline, "sun_elevation_deg", domain)} className="sun-line" />
        <polyline points={coordinateLine(timeline, "earth_elevation_deg", domain)} className="earth-line" />
        <line x1={cursorX} x2={cursorX} y1="20" y2="200" className="chart-cursor" />
      </svg>
      <div className="timeline-range-row">
        <label htmlFor="timeline-sample">Hourly midpoint <strong>{selectedIndex + 1} / {timeline.length}</strong></label>
        <input id="timeline-sample" type="range" min="0" max={timeline.length - 1} value={selectedIndex} onChange={(event) => onSelectIndex(Number(event.target.value))} />
      </div>
      <p className="chart-caption">Orange and blue lines are the returned apparent airless elevations. The dashed line is the same 0° geometric horizon used by the visibility engine.</p>
    </div>
  </section>;
}
