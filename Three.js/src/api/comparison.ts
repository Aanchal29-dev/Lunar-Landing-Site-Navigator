import { postJson } from "./client";
import type { CompareRequest, CompareResponse, MissionWindowsRequest, MissionWindowsResponse, StressTestRequest, StressTestResponse } from "./types";

export const compareLocations = (body: CompareRequest, signal?: AbortSignal) => postJson<CompareResponse>("/api/compare", body, signal);
export const stressTest = (body: StressTestRequest, signal?: AbortSignal) => postJson<StressTestResponse>("/api/stress-test", body, signal);
export const missionWindows = (body: MissionWindowsRequest, signal?: AbortSignal) => postJson<MissionWindowsResponse>("/api/mission-windows", body, signal);
