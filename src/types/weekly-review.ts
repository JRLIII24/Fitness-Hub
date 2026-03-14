export interface WeeklyTrainingSummary {
  total_sessions: number;
  total_volume_kg: number;
  total_duration_seconds: number;
  muscle_groups: { muscle_group: string; sets: number }[];
  prs: { exercise: string; weight_kg: number; reps: number }[];
  prev_week_volume: number;
  prev_week_sessions: number;
}

export interface NutritionCompliance {
  days_tracked: number;
  avg_calorie_pct: number;
  avg_protein_pct: number;
}

export interface WeeklyReviewData {
  training: WeeklyTrainingSummary;
  nutrition: NutritionCompliance | null;
  week_start: string;
  week_end: string;
}
