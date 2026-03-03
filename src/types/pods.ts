/**
 * Accountability Pods - TypeScript Types
 */

export interface Pod {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  created_at: string;
  updated_at: string;
}

export interface PodMember {
  id: string;
  pod_id: string;
  user_id: string;
  status: 'active' | 'left';
  joined_at: string;
}

export interface PodCommitment {
  id: string;
  pod_id: string;
  user_id: string;
  workouts_per_week: number;
  week_start_date: string; // ISO date string
  created_at: string;
}

export interface PodMessage {
  id: string;
  pod_id: string;
  sender_id: string;
  recipient_id: string | null; // null = message to whole pod
  message: string;
  created_at: string;
}

// Extended types with joins

export interface PodWithMembers extends Pod {
  members: Array<{
    user_id: string;
    display_name: string | null;
    username: string | null;
    joined_at: string;
    status: 'active' | 'left';
  }>;
  member_count: number;
}

export interface MemberProgress {
  user_id: string;
  display_name: string | null;
  username: string | null;
  commitment: number; // workouts per week goal
  completed: number; // workouts completed this week
  progress_percentage: number; // 0-100
  is_on_track: boolean; // >= commitment
  streak: number; // consecutive weeks meeting goal
}

export interface PodDetail extends PodWithMembers {
  members_progress: MemberProgress[];
  recent_messages: Array<{
    id: string;
    sender_id: string;
    sender_name: string | null;
    recipient_id: string | null;
    recipient_name: string | null;
    message: string;
    created_at: string;
  }>;
}

// ── Pod Challenges ────────────────────────────────────────────────────────────

export type ChallengeType = 'volume' | 'consistency';

export interface PodChallenge {
  id: string;
  pod_id: string;
  name: string;
  challenge_type: ChallengeType;
  start_date: string; // ISO date (YYYY-MM-DD)
  end_date: string;   // ISO date (YYYY-MM-DD), inclusive
  target_value: number | null;
  created_by: string;
  created_at: string;
}

export interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  /** Score in natural units: kg (volume), sessions (consistency) */
  score: number;
  rank: number;
  workouts_cnt: number;
}

export interface ChallengeLeaderboard {
  challenge: PodChallenge;
  entries: LeaderboardEntry[];
  score_unit: 'kg' | 'sessions';
  is_active: boolean;
}

export interface CreateChallengeInput {
  name: string;
  challenge_type: ChallengeType;
  start_date: string;
  end_date: string;
  target_value?: number;
}

// ── Template Marketplace ───────────────────────────────────────────────────────

export interface PublicTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  estimated_duration_min: number | null;
  is_public: boolean;
  save_count: number;
  primary_muscle_group: string | null;
  difficulty_level?: string; // 'warm_up' | 'grind' | 'beast_mode'
  created_at: string;
  updated_at: string;
  /** Only present when querying with exercise join */
  template_exercises?: Array<{
    id: string;
    exercise_id: string;
    sort_order: number;
    target_sets: number | null;
    target_reps: string | null;
    target_weight_kg: number | null;
    rest_seconds: number;
    notes: string | null;
    exercises?: {
      id: string;
      name: string;
      muscle_group: string;
      equipment: string;
      category: string;
    };
  }>;
  /** Only present when joined with saves */
  is_saved?: boolean;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  /** Aggregate rating data joined from template_rating_stats */
  avg_rating?: number | null;
  review_count?: number;
}

/** A single review row returned from the API */
export interface TemplateReview {
  id: string;
  template_id: string;
  reviewer_id: string;
  rating: number;       // 1–5
  comment: string | null;
  created_at: string;
  reviewer?: {
    display_name: string | null;
    avatar_url: string | null;
  };
  /** True if this review belongs to the currently logged-in user */
  is_own?: boolean;
}

// Form types

export interface CreatePodInput {
  name: string;
  description?: string;
}

export interface InviteMemberInput {
  username: string;
}

export interface SetCommitmentInput {
  workouts_per_week: number;
}

export interface SendMessageInput {
  message: string;
  recipient_id?: string; // undefined = send to whole pod
}
