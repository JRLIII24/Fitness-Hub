"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useSupabase } from "./use-supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface PresenceState {
  user_id: string;
  online_at: number;
}

const onlineUsers = new Set<string>();
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

export function usePresence(userId: string | null) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel("global-presence", {
      config: { presence: { key: userId } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState<PresenceState>();
        const currentlyOnline = new Set(Object.keys(state));
        // Update global set
        onlineUsers.clear();
        currentlyOnline.forEach((id) => onlineUsers.add(id));
        notifyListeners();
      })
      .on("presence", { event: "join" }, ({ key }) => {
        onlineUsers.add(key);
        notifyListeners();
      })
      .on("presence", { event: "leave" }, ({ key }) => {
        onlineUsers.delete(key);
        notifyListeners();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: Date.now() });
        }
      });

    channelRef.current = channel;

    // Heartbeat: update last_seen_at in DB every 60s
    heartbeatRef.current = setInterval(async () => {
      await supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", userId);
    }, 60_000);

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [userId, supabase]);

  const isOnline = useCallback((targetUserId: string): boolean => {
    return onlineUsers.has(targetUserId);
  }, []);

  return { isOnline };
}

// Hook to subscribe to presence changes for reactive UI
export function useIsOnline(targetUserId: string): boolean {
  const [online, setOnline] = useState(onlineUsers.has(targetUserId));

  useEffect(() => {
    const update = () => setOnline(onlineUsers.has(targetUserId));
    listeners.add(update);
    update(); // sync immediately
    return () => {
      listeners.delete(update);
    };
  }, [targetUserId]);

  return online;
}
