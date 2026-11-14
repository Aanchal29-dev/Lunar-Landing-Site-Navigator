import { postJson } from "./client";
import type { TerrainRequest, TerrainResponse } from "./types";

export function analyzeTerrain(body: TerrainRequest, signal?: AbortSignal): Promise<TerrainResponse> {
  return postJson<TerrainResponse>("/api/terrain/analyze", body, signal);
}
