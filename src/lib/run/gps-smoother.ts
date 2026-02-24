import type { GpsPoint } from "@/types/run";
import { haversineDistanceM } from "./geo";

const MAX_REALISTIC_SPEED_MS = 12; // ~43 km/h
const MIN_ACCURACY_M = 50;
const MIN_DISTANCE_THRESHOLD_M = 3;

export function shouldAcceptPoint(
  candidate: GpsPoint,
  lastAccepted: GpsPoint | null,
  elapsedMs: number
): boolean {
  if (candidate.accuracy > MIN_ACCURACY_M) return false;
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
