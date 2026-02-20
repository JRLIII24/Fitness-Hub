/**
 * Pods Hook
 * React hook for managing accountability pods
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { PodWithMembers, PodDetail, MemberProgress } from '@/types/pods';
import {
  trackPodAccountabilityPingSent,
  trackPodCommitmentMissed,
  trackPodCommitmentSet,
} from '@/lib/retention-events';

interface UsePods {
  pods: PodWithMembers[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createPod: (name: string, description?: string) => Promise<string | null>;
  deletePod: (podId: string) => Promise<boolean>;
}

export function usePods(): UsePods {
  const [pods, setPods] = useState<PodWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPods = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/pods');
      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ API error response:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to load pods');
      }
      const data = await res.json();
      console.log('✅ Pods loaded:', data.pods);
      setPods(data.pods || []);
    } catch (err) {
      console.error('Fetch pods error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPods();
  }, [fetchPods]);

  const createPod = async (name: string, description?: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/pods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description })
      });

      if (!res.ok) {
        const errorData = await res.json();
        console.error('❌ Create pod error:', errorData);
        throw new Error(errorData.details || errorData.error || 'Failed to create pod');
      }

      const data = await res.json();
      console.log('✅ Pod created:', data.pod);
      await fetchPods(); // Refresh list
      return data.pod.id;
    } catch (err) {
      console.error('Create pod error:', err);
      setError(err instanceof Error ? err.message : 'Failed to create pod');
      return null;
    }
  };

  const deletePod = async (podId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pods/${podId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete pod');
      }

      await fetchPods(); // Refresh list
      return true;
    } catch (err) {
      console.error('Delete pod error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete pod');
      return false;
    }
  };

  return {
    pods,
    loading,
    error,
    refetch: fetchPods,
    createPod,
    deletePod
  };
}

interface UsePodDetail {
  pod: PodDetail | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  inviteMember: (username: string) => Promise<{ success: boolean; message: string }>;
  setCommitment: (workoutsPerWeek: number) => Promise<boolean>;
  sendMessage: (message: string, recipientId?: string) => Promise<boolean>;
  leavePod: () => Promise<boolean>;
  deletePod: (podId: string) => Promise<boolean>;
}

export function usePodDetail(podId: string): UsePodDetail {
  const supabase = useMemo(() => createClient(), []);
  const [pod, setPod] = useState<PodDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPodDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/pods/${podId}`);
      if (!res.ok) throw new Error('Failed to load pod details');
      const data = await res.json();
      setPod(data.pod);
    } catch (err) {
      console.error('Fetch pod detail error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pod');
    } finally {
      setLoading(false);
    }
  }, [podId]);

  useEffect(() => {
    if (podId) fetchPodDetail();
  }, [podId, fetchPodDetail]);

  useEffect(() => {
    if (!pod) return;
    const podSnapshot = pod;
    let active = true;

    async function detectMissedCommitment() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active || !user) return;

      const self = podSnapshot.members_progress.find((m) => m.user_id === user.id);
      if (!self || self.commitment <= 0 || self.is_on_track) return;

      const now = new Date();
      const monday = new Date(now);
      const day = monday.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      monday.setDate(now.getDate() + diffToMonday);
      const weekKey = monday.toISOString().slice(0, 10);
      const dedupeKey = `retention:pod_commitment_missed:${podSnapshot.id}:${weekKey}`;

      if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
      if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

      void trackPodCommitmentMissed(supabase, user.id, {
        pod_id: podSnapshot.id,
        commitment: self.commitment,
        completed: self.completed,
        progress_percentage: self.progress_percentage,
        week_start: weekKey,
      });
    }

    void detectMissedCommitment();
    return () => {
      active = false;
    };
  }, [pod, supabase]);

  const inviteMember = async (username: string): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await fetch(`/api/pods/${podId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });

      const data = await res.json();

      if (!res.ok) {
        return { success: false, message: data.error || 'Failed to invite member' };
      }

      await fetchPodDetail(); // Refresh
      return { success: true, message: data.message };
    } catch (err) {
      console.error('Invite member error:', err);
      return { success: false, message: err instanceof Error ? err.message : 'Failed to invite' };
    }
  };

  const setCommitment = async (workoutsPerWeek: number): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pods/${podId}/commitment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workouts_per_week: workoutsPerWeek })
      });

      if (!res.ok) throw new Error('Failed to set commitment');

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        void trackPodCommitmentSet(supabase, user.id, {
          pod_id: podId,
          workouts_per_week: workoutsPerWeek,
        });
      }

      await fetchPodDetail(); // Refresh to show updated progress
      return true;
    } catch (err) {
      console.error('Set commitment error:', err);
      setError(err instanceof Error ? err.message : 'Failed to set commitment');
      return false;
    }
  };

  const sendMessage = async (message: string, recipientId?: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pods/${podId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, recipient_id: recipientId })
      });

      if (!res.ok) throw new Error('Failed to send message');

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        void trackPodAccountabilityPingSent(supabase, user.id, {
          pod_id: podId,
          recipient_id: recipientId ?? null,
          channel: "pod_message",
          message_length: message.length,
        });
      }

      await fetchPodDetail(); // Refresh to show new message
      return true;
    } catch (err) {
      console.error('Send message error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      return false;
    }
  };

  const leavePod = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pods/${podId}/leave`, {
        method: 'POST'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to leave pod');
      }

      return true;
    } catch (err) {
      console.error('Leave pod error:', err);
      setError(err instanceof Error ? err.message : 'Failed to leave pod');
      return false;
    }
  };

  const deletePod = async (podId: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/pods/${podId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete pod');
      }

      return true;
    } catch (err) {
      console.error('Delete pod error:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete pod');
      return false;
    }
  };

  return {
    pod,
    loading,
    error,
    refetch: fetchPodDetail,
    inviteMember,
    setCommitment,
    sendMessage,
    leavePod,
    deletePod
  };
}
