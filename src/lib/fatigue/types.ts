export type FatigueConfidence = "low" | "medium" | "high";

export type FatigueInputs = {
  sessionLoadToday: number | null;
  avgLoad7d: number | null;
  avgLoad28d: number | null;
  strain: number | null;
  recoveryRaw: number | null;
  performanceDelta: number | null;
  performanceComparableEffort: boolean;
  hasRecoveryCheckin: boolean;
  hasPerformanceHistory: boolean;
  hasLoadData: boolean;
};

export type FatigueBreakdown = {
  loadSubscore: number;
  recoverySubscore: number;
  performanceSubscore: number;
};

export type FatigueRecommendation = {
  label: "Fresh" | "Normal" | "Building fatigue" | "High fatigue" | "Very high fatigue";
  guidance: string;
};

export type FatigueResult = FatigueBreakdown & {
  fatigueScore: number;
  confidence: FatigueConfidence;
  recommendation: FatigueRecommendation;
};

export type RecoveryCheckinInput = {
  sleep_quality: number;
  soreness: number;
  stress: number;
  motivation: number;
  notes?: string | null;
};

export type FatigueSnapshot = {
  scoreDate: string;
  timezone: string;
  fatigueScore: number;
  loadSubscore: number;
  recoverySubscore: number;
  performanceSubscore: number;
  confidence: FatigueConfidence;
  recommendation: FatigueRecommendation;
  hasRecoveryCheckin: boolean;
  hasRecentSessions: boolean;
  needsSessionRpe: boolean;
  metadata: {
    strain: number | null;
    sessionLoadToday: number | null;
    avgLoad7d: number | null;
    avgLoad28d: number | null;
    performanceDelta: number | null;
  };
};
