// ============================================================================
// Phase 1: Adaptive Intelligence Types
// ============================================================================

// =============================================================================
// WORKOUT EVENTS (Shared Event System)
// =============================================================================

export type WorkoutEventType =
  | 'workout_launched'           // Smart launcher used
  | 'workout_started'            // Session began
  | 'workout_completed'          // Session finished
  | 'workout_cancelled'          // Session abandoned
  | 'exercise_swapped'           // Exercise changed in-session
  | 'pattern_break'              // Relapse detected
  | 'comeback_started'           // Re-engagement accepted
  | 'pod_commitment_made'        // Weekly goal set
  | 'pod_commitment_met'         // Goal achieved
  | 'adaptive_workout_accepted'  // Generated workout used
  | 'adaptive_workout_modified'; // Generated workout changed

export interface WorkoutEventData {
  // Common fields
  source?: 'launcher' | 'template' | 'adaptive' | 'manual';
  template_id?: string;

  // Launch-specific
  predicted_duration_mins?: number;
  day_of_week?: number;
  confidence?: 'high' | 'medium' | 'low';

  // Completion-specific
  actual_duration_mins?: number;
  completion_rate?: number; // % of sets completed

  // Swap-specific
  from_exercise_id?: string;
  to_exercise_id?: string;
  swap_reason?: string;

  // Pattern break
  days_since_last?: number;
  usual_frequency?: number;

  // Pod-specific
  pod_id?: string;
  commitment_type?: string;
  target_sessions_per_week?: number;
}

export interface WorkoutEvent {
  id: string;
  user_id: string;
  event_type: WorkoutEventType;
  event_timestamp: string;
  session_id?: string;
  event_data: WorkoutEventData;
  created_at: string;
}

// =============================================================================
// SMART LAUNCHER
// =============================================================================

export interface LauncherPrediction {
  template_id: string | null;
  template_name: string;
  exercises: LauncherExercise[];
  estimated_duration_mins: number;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface LauncherExercise {
  exercise: {
    id: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
  };
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
  last_performance?: {
    weight_kg: number;
    reps: number;
    date: string;
  };
}

export interface LauncherResponse {
  suggested_workout: LauncherPrediction;
  alternative_templates: Array<{
    id: string;
    name: string;
    exercise_count: number;
    last_used: string;
  }>;
}

// =============================================================================
// ADAPTIVE WORKOUT GENERATOR
// =============================================================================

export type RecoveryStatus = 'fresh' | 'moderate' | 'fatigued';
export type WorkoutFocus = 'upper' | 'lower' | 'full';

export interface AdaptiveWorkoutInput {
  user_id: string;
  recovery_status: RecoveryStatus;
  available_equipment: string[];
  time_budget_mins: number;
  last_session_focus: WorkoutFocus | null;
  weekly_volume: Record<string, number>; // muscle group -> sets this week
}

export interface AdaptiveExercise {
  exercise: {
    id: string;
    name: string;
    muscle_group: string;
    equipment: string | null;
  };
  rationale: string;
  target_sets: number;
  target_reps: number;
  target_weight_kg: number | null;
}

export interface GeneratedWorkout {
  exercises: AdaptiveExercise[];
  total_estimated_duration_mins: number;
  focus: WorkoutFocus;
  confidence: number; // 0-100
  explanation: string;
}

export interface AdaptiveWorkoutCache {
  id: string;
  user_id: string;
  generated_at: string;
  valid_until: string;
  workout_data: GeneratedWorkout;
  generation_reason: string | null;
  accepted: boolean | null;
  created_at: string;
}

// =============================================================================
// ACCOUNTABILITY PODS
// =============================================================================

export interface AccountabilityPod {
  id: string;
  name: string;
  created_by: string;
  max_members: number;
  created_at: string;
  updated_at: string;
}

export interface PodMember {
  id: string;
  pod_id: string;
  user_id: string;
  joined_at: string;
  is_active: boolean;
}

export interface PodCommitment {
  id: string;
  pod_id: string;
  user_id: string;
  week_start_date: string;
  target_sessions: number;
  actual_sessions: number;
  commitment_text: string | null;
  created_at: string;
}

export interface PodMemberWithProfile {
  user: {
    id: string;
    display_name: string | null;
    username: string | null;
  };
  this_week_commitment: PodCommitment | null;
  this_week_sessions: number;
  streak: number;
  is_at_risk: boolean;
}

export interface PodDashboard {
  pod: AccountabilityPod;
  members: PodMemberWithProfile[];
  recent_activity: WorkoutEvent[];
  weekly_stats: {
    total_workouts: number;
    avg_completion_rate: number;
    members_on_track: number;
  };
}

// =============================================================================
// RELAPSE DETECTION
// =============================================================================

export type InterventionType = 'reminder' | 'plan' | 'pod_notify';
export type InterventionSeverity = 'early' | 'moderate' | 'severe';

export interface RelapseIntervention {
  id: string;
  user_id: string;
  detected_at: string;
  days_inactive: number;
  intervention_type: InterventionType;
  severity: InterventionSeverity;
  accepted_at: string | null;
  dismissed_at: string | null;
  comeback_plan_data: ComebackPlan | null;
  created_at: string;
}

export interface ComebackPlan {
  exercises: Array<{
    id: string;
    name: string;
    sets: number;
    reps: number;
    weight_kg: number;
  }>;
  target_duration_mins: number;
  intensity: 'light' | 'moderate';
  rationale: string;
}

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export interface FeatureFlags {
  launcher_enabled?: boolean;
  adaptive_workouts_v1?: boolean;
  pods_enabled?: boolean;
  relapse_detection?: boolean;
}
