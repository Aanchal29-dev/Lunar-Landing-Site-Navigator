"""Orchestration service for site comparison, mission stress testing, and bounded windows."""

from __future__ import annotations

import asyncio
import math
from datetime import timedelta

import httpx
from rasterio.errors import RasterioIOError

from app.comparison_models import (
    ComparedLocationItem,
    CompareRequest,
    CompareResponse,
    EvaluatedWindowItem,
    MissionWindowsRequest,
    MissionWindowsResponse,
    ProvenanceSummary,
    ScenarioDeltas,
    StressTestRequest,
    StressTestResponse,
)
from app.models import AnalysisRequest, Metrics
from app.services.horizons import HorizonsError
from app.services.visibility import analyze_visibility
from app.terrain_service import DatasetMismatchError, DatasetUnavailableError, TerrainService


def _build_provenance(
    results: list[ComparedLocationItem] | None = None,
    *,
    terrain_requested: bool = False,
) -> ProvenanceSummary:
    """Describe terrain availability without treating partial coverage as complete."""
    if not terrain_requested:
        terrain_source = "Terrain analysis was not requested"
    else:
        successful = [item for item in results or [] if item.status == "ok"]
        available_count = sum(item.terrain_available for item in successful)
        if successful and available_count == len(successful):
            terrain_source = "NASA GSFC PGDA LOLA Site01 elevation/slope rasters for every successful location"
        elif available_count:
            terrain_source = "NASA GSFC PGDA LOLA Site01 elevation/slope rasters where coverage is available; terrain is unavailable for one or more successful locations"
        elif successful:
            terrain_source = "No regional terrain raster coverage available for successful locations"
        else:
            terrain_source = "Terrain was not evaluated because no location produced a visibility result"
    return ProvenanceSummary(
        source_measurements=[
            "NASA JPL Horizons ephemeris (Sun and Earth apparent elevation/azimuth)",
            terrain_source,
        ],
        calculated_estimates=[
            "Hourly midpoint geometric visibility percentages, continuous gap durations, and scenario deltas",
        ],
        assumed_values=[
            "Simplified 0-degree geometric horizon at 0 km ellipsoid altitude",
            "60-minute midpoint sampling interval",
        ],
        unavailable_information=[
            "Terrain horizon ray-tracing or sub-pixel meter-scale boulders/craters",
            "Landing safety certification, solar power generation curves, or radio link margins",
        ],
    )


def _summarize_tradeoffs(items: list[ComparedLocationItem]) -> list[str]:
    valid = [(index, item) for index, item in enumerate(items) if item.status == "ok" and item.visibility is not None]
    if len(valid) < 2:
        return ["Fewer than two locations succeeded; side-by-side tradeoff comparison is unavailable."]

    label_counts = {item.label: sum(other.label == item.label for _, other in valid) for _, item in valid}

    def label(index: int, item: ComparedLocationItem) -> str:
        return item.label if label_counts[item.label] == 1 else f"{item.label} (site {index + 1})"

    notes: list[str] = []
    best_sun = max(valid, key=lambda entry: entry[1].visibility.metrics.sunlight_percent)
    worst_sun = min(valid, key=lambda entry: entry[1].visibility.metrics.sunlight_percent)
    sun_difference = best_sun[1].visibility.metrics.sunlight_percent - worst_sun[1].visibility.metrics.sunlight_percent
    if not math.isclose(sun_difference, 0.0, abs_tol=1e-9):
        notes.append(
            f"{label(*best_sun)} has higher sunlight visibility ({best_sun[1].visibility.metrics.sunlight_percent:.1f}% "
            f"vs. {worst_sun[1].visibility.metrics.sunlight_percent:.1f}% at {label(*worst_sun)})."
        )

    min_earth_gap = min(valid, key=lambda entry: entry[1].visibility.metrics.longest_earth_gap_hours)
    max_earth_gap = max(valid, key=lambda entry: entry[1].visibility.metrics.longest_earth_gap_hours)
    gap_difference = max_earth_gap[1].visibility.metrics.longest_earth_gap_hours - min_earth_gap[1].visibility.metrics.longest_earth_gap_hours
    if gap_difference:
        notes.append(
            f"{label(*min_earth_gap)} has a shorter maximum Earth-view gap "
            f"({min_earth_gap[1].visibility.metrics.longest_earth_gap_hours}h vs. "
            f"{max_earth_gap[1].visibility.metrics.longest_earth_gap_hours}h at {label(*max_earth_gap)})."
        )

    if not math.isclose(sun_difference, 0.0, abs_tol=1e-9) and gap_difference and best_sun[0] != min_earth_gap[0]:
        notes.append(
            f"Tradeoff: {label(*best_sun)} has the highest sunlight visibility in this comparison, whereas "
            f"{label(*min_earth_gap)} has the shortest maximum Earth-view gap."
        )
    if not notes:
        notes.append("The successful locations are tied on the displayed visibility metrics.")
    return notes


def _lookup_terrain_safe(latitude_deg: float, longitude_deg: float) -> dict:
    try:
        return TerrainService().analyze(latitude_deg=latitude_deg, longitude_deg=longitude_deg)
    except (DatasetUnavailableError, DatasetMismatchError, ValueError) as exc:
        return {
            "terrain_available": False,
            "warnings": [str(exc)],
        }
    except RasterioIOError:
        return {
            "terrain_available": False,
            "warnings": ["Terrain dataset could not be read; check the configured GeoTIFF files"],
        }


async def compare_locations_service(req: CompareRequest, client: httpx.AsyncClient) -> CompareResponse:
    async def evaluate_one(idx: int, loc) -> ComparedLocationItem:
        label = loc.label or f"Location {idx + 1} ({loc.latitude_deg}°, {loc.longitude_deg}°)"
        try:
            analysis_req = AnalysisRequest(
                latitude_deg=loc.latitude_deg,
                longitude_deg=loc.longitude_deg,
                start_utc=req.start_utc,
                duration_hours=req.duration_hours,
            )
            vis = await analyze_visibility(analysis_req, client)
        except (HorizonsError, ValueError) as exc:
            return ComparedLocationItem(
                label=label,
                latitude_deg=loc.latitude_deg,
                longitude_deg=loc.longitude_deg,
                status="error",
                error=str(exc),
            )

        terrain_data = None
        terrain_ok = False
        if req.include_terrain:
            terrain_data = await asyncio.to_thread(_lookup_terrain_safe, loc.latitude_deg, loc.longitude_deg)
            terrain_ok = bool(terrain_data.get("terrain_available", False))

        return ComparedLocationItem(
            label=label,
            latitude_deg=loc.latitude_deg,
            longitude_deg=loc.longitude_deg,
            status="ok",
            visibility=vis,
            terrain=terrain_data,
            terrain_available=terrain_ok,
        )

    results = list(await asyncio.gather(*(evaluate_one(i, loc) for i, loc in enumerate(req.locations))))
    return CompareResponse(
        start_utc=req.start_utc,
        duration_hours=req.duration_hours,
        results=results,
        tradeoffs=_summarize_tradeoffs(results),
        provenance=_build_provenance(results, terrain_requested=req.include_terrain),
    )


async def stress_test_service(req: StressTestRequest, client: httpx.AsyncClient) -> StressTestResponse:
    baseline_req = AnalysisRequest(
        latitude_deg=req.latitude_deg,
        longitude_deg=req.longitude_deg,
        start_utc=req.baseline.start_utc,
        duration_hours=req.baseline.duration_hours,
    )
    variant_req = AnalysisRequest(
        latitude_deg=req.latitude_deg,
        longitude_deg=req.longitude_deg,
        start_utc=req.variant.start_utc,
        duration_hours=req.variant.duration_hours,
    )

    baseline_res, variant_res = await asyncio.gather(
        analyze_visibility(baseline_req, client),
        analyze_visibility(variant_req, client),
    )

    bm = baseline_res.metrics
    vm = variant_res.metrics

    deltas = ScenarioDeltas(
        sunlight_percent_delta=round(vm.sunlight_percent - bm.sunlight_percent, 2),
        earth_visibility_percent_delta=round(vm.earth_visibility_percent - bm.earth_visibility_percent, 2),
        longest_darkness_hours_delta=vm.longest_darkness_hours - bm.longest_darkness_hours,
        longest_earth_gap_hours_delta=vm.longest_earth_gap_hours - bm.longest_earth_gap_hours,
        duration_hours_delta=req.variant.duration_hours - req.baseline.duration_hours,
    )

    warnings: list[str] = []
    if deltas.duration_hours_delta != 0:
        warnings.append(
            f"Mission duration changed ({req.baseline.duration_hours}h -> {req.variant.duration_hours}h); "
            "percentages are computed over different mission lengths."
        )
    if deltas.sunlight_percent_delta > 0 and deltas.longest_darkness_hours_delta > 0:
        warnings.append(
            f"Sunlight % increased (+{deltas.sunlight_percent_delta}%), but longest continuous darkness "
            f"worsened by +{deltas.longest_darkness_hours_delta}h."
        )
    if deltas.earth_visibility_percent_delta > 0 and deltas.longest_earth_gap_hours_delta > 0:
        warnings.append(
            f"Earth visibility % increased (+{deltas.earth_visibility_percent_delta}%), but longest continuous Earth gap "
            f"worsened by +{deltas.longest_earth_gap_hours_delta}h."
        )

    return StressTestResponse(
        latitude_deg=req.latitude_deg,
        longitude_deg=req.longitude_deg,
        baseline=baseline_res,
        variant=variant_res,
        deltas=deltas,
        warnings=warnings,
        provenance=_build_provenance(),
    )


def _score_window(metrics: Metrics, duration_hours: int, priority: str) -> float:
    sun = metrics.sunlight_percent
    earth = metrics.earth_visibility_percent
    dark_pen = (metrics.longest_darkness_hours / duration_hours) * 100.0
    gap_pen = (metrics.longest_earth_gap_hours / duration_hours) * 100.0

    if priority == "max_sunlight":
        return sun - 0.5 * dark_pen
    if priority == "min_earth_gap":
        return earth - gap_pen
    return 0.5 * sun + 0.5 * earth - 0.25 * (dark_pen + gap_pen)


async def mission_windows_service(req: MissionWindowsRequest, client: httpx.AsyncClient) -> MissionWindowsResponse:
    offsets = sorted(set(req.candidate_offsets_days))

    async def eval_offset(offset: int) -> EvaluatedWindowItem:
        cand_start = req.target_start_utc + timedelta(days=offset)
        try:
            cand_req = AnalysisRequest(
                latitude_deg=req.latitude_deg,
                longitude_deg=req.longitude_deg,
                start_utc=cand_start,
                duration_hours=req.duration_hours,
            )
            vis = await analyze_visibility(cand_req, client)
            score = _score_window(vis.metrics, req.duration_hours, req.priority)
            return EvaluatedWindowItem(
                offset_days=offset,
                start_utc=cand_start,
                status="ok",
                visibility=vis,
                score=score,
            )
        except (HorizonsError, ValueError) as exc:
            return EvaluatedWindowItem(
                offset_days=offset,
                start_utc=cand_start,
                status="error",
                error=str(exc),
            )

    evaluated = list(await asyncio.gather(*(eval_offset(o) for o in offsets)))
    valid = [w for w in evaluated if w.status == "ok" and w.score is not None]
    preferred = max(valid, key=lambda w: w.score) if valid else None

    criteria_map = {
        "balanced": "Weighted score combining Sunlight %, Earth %, and continuous blackout penalties.",
        "max_sunlight": "Highest Sunlight % minus continuous darkness penalty.",
        "min_earth_gap": "Highest Earth visibility % minus continuous Earth gap penalty.",
    }

    return MissionWindowsResponse(
        latitude_deg=req.latitude_deg,
        longitude_deg=req.longitude_deg,
        duration_hours=req.duration_hours,
        selection_criteria=criteria_map[req.priority],
        tested_offsets_days=offsets,
        evaluated_windows=evaluated,
        preferred_window=preferred,
        tradeoffs=[
            f"Evaluated {len(offsets)} candidate start offsets ({offsets} days) using the visibility engine.",
            "Preferred window is optimal only among these tested candidates under stated criteria, not globally optimal.",
        ],
        is_globally_optimal=False,
        provenance=_build_provenance(),
    )
