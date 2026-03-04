import { Capacitor } from '@capacitor/core';

export async function isHealthKitAvailable(): Promise<boolean> {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function requestHealthKitPermission(): Promise<boolean> {
  // Stub — actual HealthKit plugin would be integrated here
  console.warn('HealthKit integration requires @anthropic/capacitor-health plugin');
  return false;
}

export async function syncHealthData(): Promise<{
  sleepHours: number | null;
  restingHeartRate: number | null;
  hrvMs: number | null;
  steps: number | null;
} | null> {
  // Stub for future HealthKit plugin integration
  return null;
}
