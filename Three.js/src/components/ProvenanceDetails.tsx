import type { Provenance } from "../api/types";

export function ProvenanceDetails({ provenance }: { provenance: Provenance }) {
  const groups: Array<[string, string[]]> = [
    ["Source measurements", provenance.source_measurements],
    ["Calculated estimates", provenance.calculated_estimates],
    ["Assumed values", provenance.assumed_values],
    ["Unavailable information", provenance.unavailable_information],
  ];
  return <details className="provenance-details"><summary>Data provenance and scope</summary>
    {groups.map(([heading, entries]) => <div key={heading}><strong>{heading}</strong>{entries.length ? <ul>{entries.map((entry) => <li key={entry}>{entry}</li>)}</ul> : <p>None reported.</p>}</div>)}
  </details>;
}
