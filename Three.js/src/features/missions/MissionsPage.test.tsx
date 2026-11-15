import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { PlanProvider } from "../../app/PlanProvider";
import { MissionDetailPage, MissionsPage } from "./MissionsPage";

const location = { name: "Actual site", latitude_deg: -69.3, longitude_deg: 32.3, location_type: "actual_landing", coordinate_quality: "confirmed", precision_or_uncertainty: "Recorded coordinate", coordinate_reference: "Moon ME", original_coordinate_text: "69.3 S, 32.3 E", source_keys: ["source"] };
const summary = { id: "test_mission", name: "Test Mission", country: "India", operator: "Agency", event_time_utc: "2023-08-23T12:00:00Z", time_precision: "minute", landing_outcome: "success", marker_location: location, replay: { status: "ineligible", location_field: "actual_location", label: "No replay" } };
const detail = { ...summary, spacecraft_or_lander: "Lander", event_description: "Documented event.", mission_objective: "Objective.", overall_mission_outcome: "Completed.", documented_failure_reason: null, what_happened: "It landed.", achievements: "Achievement.", intended_location: location, actual_location: location, media: [], sources: [{ key: "source", title: "Primary source", url: "https://example.test/source", supports: "Mission details" }] };

afterEach(() => { cleanup(); sessionStorage.clear(); vi.unstubAllGlobals(); });

describe("Historical mission routes", () => {
  it("renders only backend-supplied mission cards", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify([summary]), { status: 200 })));
    render(<MemoryRouter><MissionsPage /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Test Mission" })).not.toBeNull();
  });
  it("renders documented detail and source links without a placeholder replay", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(detail), { status: 200 })));
    render(<MemoryRouter initialEntries={["/missions/test_mission"]}><PlanProvider><Routes><Route path="/missions/:missionId" element={<MissionDetailPage />} /></Routes></PlanProvider></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Test Mission" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "Primary source" })).not.toBeNull();
    expect(screen.getByText(/not eligible for replay/)).not.toBeNull();
  });
});
