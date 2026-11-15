import { postJson, requestJson } from "./client";
import type { HistoricalReplayResponse, MissionDetail, MissionSummary } from "./types";
import { assertHistoricalReplayResponse, assertMissionDetail, assertMissionSummaries } from "./validateMissions";

export async function listMissions(signal?: AbortSignal): Promise<MissionSummary[]> {
  return assertMissionSummaries(await requestJson<unknown>("/api/missions", { signal }));
}
export async function getMission(missionId: string, signal?: AbortSignal): Promise<MissionDetail> {
  return assertMissionDetail(await requestJson<unknown>(`/api/missions/${encodeURIComponent(missionId)}`, { signal }));
}
export async function replayMission(missionId: string, duration_hours = 144, signal?: AbortSignal): Promise<HistoricalReplayResponse> {
  return assertHistoricalReplayResponse(await postJson<unknown>(`/api/missions/${encodeURIComponent(missionId)}/replay`, { duration_hours }, signal));
}
