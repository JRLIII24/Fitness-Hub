import { z } from "zod";

const runTagValues = [
  "recovery",
  "conditioning",
  "hiit",
  "speed_work",
  "game_prep",
  "long_run",
  "tempo",
  "easy",
] as const;

const zoneValues = [
  "zone1_active_recovery",
  "zone2_aerobic",
  "zone3_tempo",
  "zone4_threshold",
  "zone5_anaerobic",
] as const;

const zoneBreakdownSchema = z.object({
  zone1_active_recovery: z.number().int().min(0),
  zone2_aerobic: z.number().int().min(0),
  zone3_tempo: z.number().int().min(0),
  zone4_threshold: z.number().int().min(0),
  zone5_anaerobic: z.number().int().min(0),
});

const splitSchema = z.object({
  split_number: z.number().int().min(1),
  split_distance_meters: z.number().min(100),
  duration_seconds: z.number().int().min(1),
  pace_sec_per_km: z.number().min(0),
  elevation_gain_m: z.number().nullable(),
  elevation_loss_m: z.number().nullable(),
  zone: z.enum(zoneValues).nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  started_at: z.string().datetime(),
  completed_at: z.string().datetime(),
});

export const saveRunSchema = z
  .object({
    local_id: z.string().uuid(),
    name: z.string().min(1).max(100),
    tag: z.enum(runTagValues).nullable(),
    notes: z.string().max(2000).nullable().optional(),
    started_at: z.string().datetime(),
    completed_at: z.string().datetime(),
    duration_seconds: z.number().int().min(1),
    moving_duration_seconds: z.number().int().min(0),
    distance_meters: z.number().min(0),
    avg_pace_sec_per_km: z.number().min(0).nullable(),
    best_pace_sec_per_km: z.number().min(0).nullable(),
    elevation_gain_m: z.number().min(0).nullable(),
    elevation_loss_m: z.number().min(0).nullable(),
    avg_cadence_spm: z.number().min(0).nullable().optional(),
    estimated_calories: z.number().int().min(0).nullable(),
    session_rpe: z.number().min(0).max(10).nullable(),
    estimated_vo2max: z.number().min(10).max(90).nullable(),
    session_load: z.number().min(0).nullable(),
    zone_breakdown: zoneBreakdownSchema,
    primary_zone: z.enum(zoneValues).nullable(),
    route_polyline: z.string().max(100_000).nullable(),
    is_treadmill: z.boolean(),
    map_bbox: z
      .object({
        minLat: z.number(),
        maxLat: z.number(),
        minLng: z.number(),
        maxLng: z.number(),
      })
      .nullable(),
    splits: z.array(splitSchema).max(500),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();

export const patchRunSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    tag: z.enum(runTagValues).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    session_rpe: z.number().min(0).max(10).nullable().optional(),
  })
  .strict();

export const activeRunSchema = z
  .object({
    run_session_id: z.string().uuid(),
    session_name: z.string().min(1).max(100),
  })
  .strict();

export type SaveRunInput = z.infer<typeof saveRunSchema>;
export type PatchRunInput = z.infer<typeof patchRunSchema>;
