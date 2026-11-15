import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TimelineEntry } from "../../api/types";
import { VisibilityExplorer } from "./VisibilityExplorer";

const timeline: TimelineEntry[] = [
  { interval_start_utc: "2026-11-20T00:00:00Z", interval_end_utc: "2026-11-20T01:00:00Z", sample_utc: "2026-11-20T00:30:00Z", sun_azimuth_deg: 0, sun_elevation_deg: 10, earth_azimuth_deg: 90, earth_elevation_deg: -2, sun_visible: true, earth_visible: false },
  { interval_start_utc: "2026-11-20T01:00:00Z", interval_end_utc: "2026-11-20T02:00:00Z", sample_utc: "2026-11-20T01:30:00Z", sun_azimuth_deg: 30, sun_elevation_deg: -5, earth_azimuth_deg: 120, earth_elevation_deg: 8, sun_visible: false, earth_visible: true },
];

describe("VisibilityExplorer", () => {
  it("synchronizes the sky readout with the selected returned timeline midpoint", () => {
    const onSelectIndex = vi.fn();
    const { rerender } = render(<VisibilityExplorer timeline={timeline} selectedIndex={0} onSelectIndex={onSelectIndex} />);

    expect(screen.getByText("2026-11-20T00:30:00Z UTC")).not.toBeNull();
    fireEvent.change(screen.getByLabelText(/Hourly midpoint/), { target: { value: "1" } });
    expect(onSelectIndex).toHaveBeenCalledWith(1);

    rerender(<VisibilityExplorer timeline={timeline} selectedIndex={1} onSelectIndex={onSelectIndex} />);
    expect(screen.getByText("2026-11-20T01:30:00Z UTC")).not.toBeNull();
    expect(screen.getByText(/-5.00° elevation/)).not.toBeNull();
  });
});
