"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSupabase } from "./use-supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PodPresenceState {
  user_id: string;
  status: "online" | "in_gym";
  online_at: number;
  workout_name?: string;
  started_at?: string;
}

export type { PodPresenceState };

/**
 * Pod-scoped Supabase Realtime presence.
 * Tracks which pod members are online or actively working out.
 */
export function usePodPresence(podId: string | null, userId: string | null) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [presenceMap, setPresenceMap] = useState<Map<string, PodPresenceState>>(
    new Map()
  );

  const track = useCallback(
    async (
      status: "online" | "in_gym",
      meta?: { workout_name?: string; started_at?: string }
    ) => {
      if (!channelRef.current || !userId) return;
      await channelRef.current.track({
        user_id: userId,
        status,
        online_at: Date.now(),
        ...meta,
      });
    },
    [userId]
  );

  useEffect(() => {
    if (!podId || !userId) return;

    const channel = supabase.channel(`pod-presence-${podId}`, {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PodPresenceState>();
        const map = new Map<string, PodPresenceState>();
        for (const [key, presences] of Object.entries(state)) {
          if (presences.length > 0) {
            map.set(key, presences[0] as PodPresenceState);
          }
        }
        setPresenceMap(map);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: userId,
            status: "online" as const,
            online_at: Date.now(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [podId, userId, supabase]);

  return {
    /** Map of user_id → presence state */
    presenceMap,
    /** Check if a user is currently online */
    isOnline: (uid: string) => presenceMap.has(uid),
    /** Check if a user is in the gym */
    isInGym: (uid: string) => presenceMap.get(uid)?.status === "in_gym",
    /** Get full presence state for a user */
    getPresence: (uid: string) => presenceMap.get(uid),
    /** Update current user's presence status */
    track,
  };
}
