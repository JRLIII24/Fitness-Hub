interface PaceWindowEntry {
  distM: number;
  timestampMs: number;
}

const PACE_WINDOW_MS = 30_000;

export function computeRollingPaceSecPerKm(
  window: PaceWindowEntry[],
  newEntry: PaceWindowEntry
): number {
  window.push(newEntry);

  const cutoff = newEntry.timestampMs - PACE_WINDOW_MS;
  while (window.length > 1 && window[0].timestampMs < cutoff) {
    window.shift();
  }

  if (window.length < 2) return 0;

  const totalDistM = window.reduce((sum, e) => sum + e.distM, 0);
  const elapsedMs = newEntry.timestampMs - window[0].timestampMs;
  if (elapsedMs <= 0 || totalDistM <= 0) return 0;

  const speedMs = totalDistM / (elapsedMs / 1000);
  if (speedMs <= 0) return 0;

  return 1000 / speedMs;
}

export function computeAvgPaceSecPerKm(
  totalDistM: number,
  movingDurationSeconds: number
): number {
  if (totalDistM <= 0 || movingDurationSeconds <= 0) return 0;
  const speedMs = totalDistM / movingDurationSeconds;
  return 1000 / speedMs;
}

export function formatPaceDisplay(secPerKm: number, isImperial: boolean): string {
  if (secPerKm <= 0) return "--:--";
  const totalSec = isImperial ? secPerKm * 1.60934 : secPerKm;
  const min = Math.floor(totalSec / 60);
  const sec = Math.round(totalSec % 60);
  return `${min}:${sec.toString().padStart(2, "0")}`;
}
