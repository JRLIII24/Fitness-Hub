// ─── Enums ────────────────────────────────────────────────────────────────────

export type RunTag =
  | "recovery"
  | "conditioning"
  | "hiit"
  | "speed_work"
  | "game_prep"
  | "long_run"
  | "tempo"
  | "easy";

export type RunIntensityZone =
  | "zone1_active_recovery"
  | "zone2_aerobic"
  | "zone3_tempo"
  | "zone4_threshold"
  | "zone5_anaerobic";

export type RunStatus = "in_progress" | "paused" | "completed" | "cancelled";

export type RunLifecycleState =
  | "idle"
  | "ready"
  | "running"
  | "paused"
  | "auto_paused"
  | "finishing"
  | "saving"
  | "completed";

// ─── GPS ──────────────────────────────────────────────────────────────────────

export interface GpsPoint {
  lat: number;
  lng: number;
  altitude: number | null;
  accuracy: number;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

export interface SmoothedGpsPoint extends GpsPoint {
  distanceFromPrev: number;
  cumulativeDistanceM: number;
}

// ─── Zone Breakdown ───────────────────────────────────────────────────────────

export interface ZoneBreakdown {
  zone1_active_recovery: number;
  zone2_aerobic: number;
  zone3_tempo: number;
  zone4_threshold: number;
  zone5_anaerobic: number;
}

// ─── Map ──────────────────────────────────────────────────────────────────────

export interface MapBbox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// ─── Run Split ────────────────────────────────────────────────────────────────

export interface RunSplit {
  id: string;
  run_session_id: string;
  user_id: string;
  split_number: number;
  split_distance_meters: number;
  duration_seconds: number;
  pace_sec_per_km: number;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  zone: RunIntensityZone | null;
  lat: number | null;
  lng: number | null;
  started_at: string;
  completed_at: string;
}

// ─── Run Session (persisted) ──────────────────────────────────────────────────

export interface RunSession {
  id: string;
  user_id: string;
  name: string;
  status: RunStatus;
  tag: RunTag | null;
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  moving_duration_seconds: number | null;
  distance_meters: number | null;
  avg_pace_sec_per_km: number | null;
  best_pace_sec_per_km: number | null;
  elevation_gain_m: number | null;
  elevation_loss_m: number | null;
  avg_cadence_spm: number | null;
  estimated_calories: number | null;
  session_rpe: number | null;
  estimated_vo2max: number | null;
  session_load: number | null;
  zone_breakdown: ZoneBreakdown;
  primary_zone: RunIntensityZone | null;
  route_polyline: string | null;
  is_treadmill: boolean;
  map_bbox: MapBbox | null;
  created_at: string;
}

// ─── Run Metrics (weekly rollup) ──────────────────────────────────────────────

export interface RunMetrics {
  id: string;
  user_id: string;
  week_start_date: string;
  total_distance_meters: number;
  total_duration_seconds: number;
  total_runs: number;
  run_load_this_week: number | null;
  lift_load_this_week: number | null;
  combined_load: number | null;
  estimated_vo2max: number | null;
  computed_at: string;
}

// ─── Active Run (client state) ────────────────────────────────────────────────

export interface ActiveRun {
  id: string;
  name: string;
  tag: RunTag | null;
  startedAt: number;
  pausedAt: number | null;
  totalPausedMs: number;
  isTreadmill: boolean;

  distanceM: number;
  currentPaceSecPerKm: number;
  avgPaceSecPerKm: number;
  bestPaceSecPerKm: number;
  elevationGainM: number;
  elevationLossM: number;
  lastAltitude: number | null;

  splits: RunSplit[];

  nextSplitDistanceM: number;
  currentSplitStartedAt: number;
  currentSplitStartDistanceM: number;

  zoneSeconds: ZoneBreakdown;
  currentZone: RunIntensityZone | null;

  gpsAccuracy: number | null;
  lastGpsTimestamp: number | null;

  autoPauseThresholdMs: number;
  movingTimeMs: number;
}

// ─── Pre-run Readiness ────────────────────────────────────────────────────────

export interface RunReadinessData {
  fatigueScore: number;
  fatigueLabel: string;
  fatigueGuidance: string;
  lastRunDaysAgo: number | null;
  lastLiftDaysAgo: number | null;
  weeklyRunDistanceM: number;
  weeklyRunCount: number;
  recommendation: "go" | "easy" | "rest";
}

// ─── Run Tag Labels ───────────────────────────────────────────────────────────

export const RUN_TAG_LABELS: Record<RunTag, string> = {
  recovery: "Recovery",
  conditioning: "Conditioning",
  hiit: "HIIT",
  speed_work: "Speed Work",
  game_prep: "Game Prep",
  long_run: "Long Run",
  tempo: "Tempo",
  easy: "Easy",
};

export const ZONE_LABELS: Record<RunIntensityZone, string> = {
  zone1_active_recovery: "Zone 1 · Recovery",
  zone2_aerobic: "Zone 2 · Aerobic",
  zone3_tempo: "Zone 3 · Tempo",
  zone4_threshold: "Zone 4 · Threshold",
  zone5_anaerobic: "Zone 5 · Anaerobic",
};

export const ZONE_SHORT_LABELS: Record<RunIntensityZone, string> = {
  zone1_active_recovery: "Z1",
  zone2_aerobic: "Z2",
  zone3_tempo: "Z3",
  zone4_threshold: "Z4",
  zone5_anaerobic: "Z5",
};

export const ZONE_COLORS: Record<RunIntensityZone, string> = {
  zone1_active_recovery: "#94a3b8", // slate-400
  zone2_aerobic: "#60a5fa",         // blue-400
  zone3_tempo: "#34d399",           // emerald-400
  zone4_threshold: "#fb923c",       // orange-400
  zone5_anaerobic: "#f87171",       // red-400
};
