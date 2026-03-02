import type { GpsPoint } from "@/types/run";
import { haversineDistanceM } from "./geo";

const MAX_REALISTIC_SPEED_MS = 12; // ~43 km/h
const MIN_ACCURACY_M = 20; // tightened from 50 — reject noisy fixes
const MIN_DISTANCE_THRESHOLD_M = 3;
const MIN_DEVICE_SPEED_MS = 0.3; // below this the device considers the user stationary

export function shouldAcceptPoint(
  candidate: GpsPoint,
  lastAccepted: GpsPoint | null,
  elapsedMs: number
): boolean {
  // Reject inaccurate fixes
  if (candidate.accuracy > MIN_ACCURACY_M) return false;

  // Device-reported speed gate: if the hardware says the user is stationary,
  // don't accumulate distance from GPS jitter
  if (
    candidate.speed !== null &&
    candidate.speed !== undefined &&
    candidate.speed < MIN_DEVICE_SPEED_MS
  ) {
    return false;
  }

  if (!lastAccepted) return true;

  const distM = haversineDistanceM(
    lastAccepted.lat,
    lastAccepted.lng,
    candidate.lat,
    candidate.lng
  );

  if (distM < MIN_DISTANCE_THRESHOLD_M) return false;

  if (elapsedMs > 0) {
    const impliedSpeedMs = distM / (elapsedMs / 1000);
    if (impliedSpeedMs > MAX_REALISTIC_SPEED_MS) return false;
  }

  return true;
}

export function computeElevationDelta(
  currentAltitude: number | null,
  previousAltitude: number | null
): number {
  if (currentAltitude == null || previousAltitude == null) return 0;
  return currentAltitude - previousAltitude;
}
