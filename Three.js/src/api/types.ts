export type ApiValidationDetail = { type: string; loc: Array<string | number>; msg: string };
export type ApiErrorBody = { detail?: string | ApiValidationDetail[] };

export type AnalysisRequest = {
  latitude_deg: number;
  longitude_deg: number;
  start_utc: string;
  duration_hours: number;
};

export type TimelineEntry = {
  interval_start_utc: string;
  interval_end_utc: string;
  sample_utc: string;
  sun_azimuth_deg: number;
  sun_elevation_deg: number;
  earth_azimuth_deg: number;
  earth_elevation_deg: number;
  sun_visible: boolean;
  earth_visible: boolean;
};

export type AnalysisResponse = {
  location: { latitude_deg: number; longitude_deg: number };
  start_utc: string;
  end_utc: string;
  duration_hours: number;
  sampling_minutes: 60;
  metrics: {
    sunlight_percent: number;
    earth_visibility_percent: number;
    longest_darkness_hours: number;
    longest_earth_gap_hours: number;
  };
  timeline: TimelineEntry[];
  model: {
    type: "simplified_geometric_horizon";
    horizon_degrees: 0;
    site_altitude_km: 0;
    terrain_obstruction_included: false;
    sampling_method: "hourly_midpoints";
    source: "NASA JPL Horizons";
    lunar_reference_frame: string;
    lunar_radii_km: [number, number, number];
    limitations: string[];
  };
};

export type TerrainRequest = {
  latitude_deg: number;
  longitude_deg: number;
  analysis_radius_m?: number;
};

export type TerrainResponse = {
  terrain_available: boolean;
  location: { latitude_deg: number; longitude_deg: number };
  pixel: { row: number | null; column: number | null; elevation_m: number | null; slope_deg: number | null };
  region: {
    analysis_radius_m: number;
    mean_elevation_m: number | null;
    elevation_range_m: number | null;
    mean_slope_deg: number | null;
    maximum_slope_deg: number | null;
    elevation_stddev_m_roughness_proxy: number | null;
    valid_pixel_count: number;
    total_pixel_count: number;
    valid_pixel_percentage: number;
    valid_data_percentage: number;
    requested_area_coverage_percentage: number;
    coverage_status: string;
  };
  raster: { resolution_m: number; crs: string; dataset_provenance: string; dataset_source_url: string; dataset_limitations: string[] };
  warnings: string[];
};

export type ComparisonLocation = { label?: string; latitude_deg: number; longitude_deg: number };
export type CompareRequest = { locations: ComparisonLocation[]; start_utc: string; duration_hours?: number; include_terrain?: boolean };
export type CompareResponse = {
  start_utc: string;
  duration_hours: number;
  results: Array<{
    label: string;
    latitude_deg: number;
    longitude_deg: number;
    status: "ok" | "error";
    error: string | null;
    visibility: AnalysisResponse | null;
    terrain: TerrainResponse | { terrain_available: false; warnings: string[] } | null;
    terrain_available: boolean;
  }>;
  tradeoffs: string[];
  provenance: Provenance;
};

export type Provenance = { source_measurements: string[]; calculated_estimates: string[]; assumed_values: string[]; unavailable_information: string[] };
export type ScenarioWindow = { start_utc: string; duration_hours?: number };
export type StressTestRequest = { latitude_deg: number; longitude_deg: number; baseline: ScenarioWindow; variant: ScenarioWindow };
export type StressTestResponse = { latitude_deg: number; longitude_deg: number; baseline: AnalysisResponse; variant: AnalysisResponse; deltas: Record<string, number>; warnings: string[]; provenance: Provenance };
export type MissionWindowsRequest = { latitude_deg: number; longitude_deg: number; target_start_utc: string; duration_hours?: number; candidate_offsets_days?: number[]; priority?: "balanced" | "max_sunlight" | "min_earth_gap" };
export type EvaluatedWindow = { offset_days: number; start_utc: string; status: "ok" | "error"; error: string | null; visibility: AnalysisResponse | null; score: number | null };
export type MissionWindowsResponse = { latitude_deg: number; longitude_deg: number; duration_hours: number; selection_criteria: string; tested_offsets_days: number[]; evaluated_windows: EvaluatedWindow[]; preferred_window: EvaluatedWindow | null; tradeoffs: string[]; is_globally_optimal: false; provenance: Provenance };

export type MissionSummary = { id: string; name: string; country: string; operator: string; event_time_utc: string; time_precision: string; landing_outcome: string; marker_location: { latitude_deg: number; longitude_deg: number; location_type: string; coordinate_quality: string }; replay: { status: string; location_field: string; label: string } };
export type MissionDetail = MissionSummary & { spacecraft_or_lander: string; event_description: string; mission_objective: string; overall_mission_outcome: string; documented_failure_reason: string | null; what_happened: string; achievements: string; intended_location: HistoricalLocation; actual_location: HistoricalLocation; media: unknown[]; sources: SourceCitation[] };
export type HistoricalLocation = { name: string; latitude_deg: number; longitude_deg: number; location_type: string; coordinate_quality: string; precision_or_uncertainty: string; coordinate_reference: string; original_coordinate_text: string; source_keys: string[] };
export type SourceCitation = { key: string; title: string; url: string; supports: string };
export type HistoricalReplayResponse = { analysis: AnalysisResponse; historical_context: { mission_id: string; location_label: string; location_type: string; coordinate_quality: string } };
