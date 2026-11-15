import { postJson } from "./client";
import type { TerrainRequest, TerrainResponse } from "./types";
import { assertTerrainResponse } from "./validateTerrain";

export async function analyzeTerrain(body: TerrainRequest, signal?: AbortSignal): Promise<TerrainResponse> {
  return assertTerrainResponse(await postJson<unknown>("/api/terrain/analyze", body, signal));
}
