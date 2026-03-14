export type ReadinessLevel = 'peak' | 'good' | 'moderate' | 'low' | 'rest';

export interface ReadinessDomainScore {
  training: number;    // 0-100
  nutrition: number;   // 0-100
  recovery: number;    // 0-100
  external: number | null; // 0-100, null when no HealthKit
}

export interface ReadinessInputs {
  fatigueScore: number | null;
  nutritionCompliance: {
    daysTracked: number;
    avgCaloriePct: number;
    avgProteinPct: number;
  } | null;
  recoveryRaw: number | null; // from deriveRecoveryRaw()
  healthKit: HealthKitData | null;
}

export interface HealthKitData {
  sleepHours: number | null;
  restingHeartRate: number | null;
  hrvMs: number | null;
  steps: number | null;
}

export interface ReadinessResult {
  readinessScore: number;  // 0-100
  level: ReadinessLevel;
  domains: ReadinessDomainScore;
  confidence: 'low' | 'medium' | 'high';
  recommendation: string;
  /** Alias for domains.training — 0-100, high = good CNS state */
  systemic_score: number;
  /** Muscle group → recovery percentage (0-100) */
  local_fatigue_map?: Record<string, number>;
}
