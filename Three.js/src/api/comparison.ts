import { postJson } from "./client";
import type { CompareRequest, CompareResponse, MissionWindowsRequest, MissionWindowsResponse, StressTestRequest, StressTestResponse } from "./types";
import { assertCompareResponse, assertMissionWindowsResponse, assertStressTestResponse } from "./validateComparison";

export async function compareLocations(body: CompareRequest, signal?: AbortSignal): Promise<CompareResponse> {
  return assertCompareResponse(await postJson<unknown>("/api/compare", body, signal));
}
export async function stressTest(body: StressTestRequest, signal?: AbortSignal): Promise<StressTestResponse> {
  return assertStressTestResponse(await postJson<unknown>("/api/stress-test", body, signal));
}
export async function missionWindows(body: MissionWindowsRequest, signal?: AbortSignal): Promise<MissionWindowsResponse> {
  return assertMissionWindowsResponse(await postJson<unknown>("/api/mission-windows", body, signal));
}
