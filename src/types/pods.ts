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
  arena_level: number;
  season_score: number;
  season_start_date: string;
}

export type ArenaTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export function getArenaTier(score: number): ArenaTier {
  if (score >= 600) return 'platinum';
  if (score >= 300) return 'gold';
  if (score >= 100) return 'silver';
  return 'bronze';
}

export const ARENA_TIERS = {
  bronze:   { label: 'Bronze',   min: 0,   max: 99,  color: '#CD7F32', next: 100 },
  silver:   { label: 'Silver',   min: 100, max: 299, color: '#C0C0C0', next: 300 },
  gold:     { label: 'Gold',     min: 300, max: 599, color: '#FFD700', next: 600 },
  platinum: { label: 'Platinum', min: 600, max: Infinity, color: '#E5E4E2', next: null },
} as const;

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
  avatar_url?: string | null;
  commitment: number; // workouts per week goal
  planned_days: string[]; // e.g. ['mon','wed','fri']
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
