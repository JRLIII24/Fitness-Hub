export type RetentionEventType =
  | "momentum_protection_shown"
  | "streak_freeze_used"
  | "streak_freeze_failed"
  | "micro_win_shown"
  | "session_intent_set"
  | "session_intent_completed"
  | "nutrition_catchup_nudge_shown"
  | "nutrition_catchup_completed"
  | "pod_commitment_set"
  | "pod_commitment_missed"
  | "pod_accountability_ping_sent"
  | "pod_accountability_ping_opened"
  | "comeback_plan_started"
  | "comeback_plan_completed"
  | "form_video_uploaded"
  | "form_analysis_completed"
  | "form_analysis_failed"
  | "form_coach_followup_opened";

export type RetentionSourceScreen =
  | "dashboard"
  | "workout"
  | "nutrition"
  | "social"
  | "social_profile"
  | "form_check"
  | "pods";

export interface RetentionEventInput {
  userId: string;
  eventType: RetentionEventType;
  sourceScreen?: RetentionSourceScreen | null;
  metadata?: Record<string, unknown>;
}
