import { describe, expect, it } from "vitest";

import { assertMissionDetail, assertMissionSummaries } from "./validateMissions";

const location = { name: "Documented location", latitude_deg: -69.3, longitude_deg: 32.3, location_type: "actual_landing", coordinate_quality: "confirmed", precision_or_uncertainty: "Recorded coordinate", coordinate_reference: "Moon ME", original_coordinate_text: "69.3 S, 32.3 E", source_keys: ["source"] };
const summary = { id: "test_mission", name: "Test Mission", country: "India", operator: "Agency", event_time_utc: "2023-08-23T12:00:00Z", time_precision: "minute", landing_outcome: "success", marker_location: location, replay: { status: "eligible", location_field: "actual_location", label: "Actual landing site" } };

describe("historical mission API boundary", () => {
  it("accepts a source-backed summary and detail", () => {
    expect(assertMissionSummaries([summary])[0]?.name).toBe("Test Mission");
    expect(assertMissionDetail({ ...summary, spacecraft_or_lander: "Lander", event_description: "Documented event.", mission_objective: "Objective.", overall_mission_outcome: "Completed.", documented_failure_reason: null, what_happened: "It landed.", achievements: "Achievement.", intended_location: location, actual_location: location, media: [], sources: [{ key: "source", title: "Primary source", url: "https://example.test/source", supports: "Mission details" }] }).id).toBe("test_mission");
  });

  it("rejects unsourced mission detail", () => {
    expect(() => assertMissionDetail({ ...summary, spacecraft_or_lander: "Lander", event_description: "Event", mission_objective: "Objective", overall_mission_outcome: "Outcome", documented_failure_reason: null, what_happened: "What", achievements: "Achievement", intended_location: location, actual_location: location, media: [], sources: [] })).toThrow("mission detail");
  });
});
