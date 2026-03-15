"use client";

import { useEffect, useRef } from "react";
import { useSupabase } from "./use-supabase";
import { useWorkoutStore } from "@/stores/workout-store";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Broadcasts workout presence to ALL of the user's pods.
 * Mount once in the app layout so it works from any page.
 *
 * When a workout is active → tracks "in_gym" with workout metadata.
 * When no workout → tracks "online".
 */
export function useWorkoutPresence(userId: string | null) {
  const supabase = useSupabase();
  const channelsRef = useRef<RealtimeChannel[]>([]);
  const podIdsRef = useRef<string[]>([]);
  const isWorkoutActive = useWorkoutStore((s) => s.isWorkoutActive);
  const activeWorkout = useWorkoutStore((s) => s.activeWorkout);

  // Fetch pod IDs once on mount
  useEffect(() => {
    if (!userId) return;

    let cancelled = false;

    async function fetchPodIds() {
      const { data } = await supabase
        .from("pod_members")
        .select("pod_id")
        .eq("user_id", userId!)
        .eq("status", "active");

      if (!cancelled && data) {
        podIdsRef.current = data.map((r) => r.pod_id);
      }
    }

    fetchPodIds();
    return () => { cancelled = true; };
  }, [userId, supabase]);

  // Subscribe to presence channels and broadcast workout status
  useEffect(() => {
    if (!userId || podIdsRef.current.length === 0) return;

    const podIds = podIdsRef.current;

    // Join presence channels for all pods
    const channels = podIds.map((podId) => {
      const channel = supabase.channel(`pod-presence-${podId}`, {
        config: { presence: { key: userId } },
      });

      channel.subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const state = useWorkoutStore.getState();
          if (state.isWorkoutActive && state.activeWorkout) {
            await channel.track({
              user_id: userId,
              status: "in_gym" as const,
              online_at: Date.now(),
              workout_name: state.activeWorkout.name,
              started_at: state.activeWorkout.started_at,
            });
          } else {
            await channel.track({
              user_id: userId,
              status: "online" as const,
              online_at: Date.now(),
            });
          }
        }
      });

      return channel;
    });

    channelsRef.current = channels;

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [userId, supabase]);

  // When workout status changes, update all channels
  useEffect(() => {
    if (!userId || channelsRef.current.length === 0) return;

    const trackAll = async () => {
      for (const channel of channelsRef.current) {
        if (isWorkoutActive && activeWorkout) {
          await channel.track({
            user_id: userId,
            status: "in_gym" as const,
            online_at: Date.now(),
            workout_name: activeWorkout.name,
            started_at: activeWorkout.started_at,
          });
        } else {
          await channel.track({
            user_id: userId,
            status: "online" as const,
            online_at: Date.now(),
          });
        }
      }
    };

    trackAll();
  }, [isWorkoutActive, activeWorkout, userId]);
}
