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
