"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "./use-supabase";
import { trackPodAccountabilityPingSent } from "@/lib/retention-events";

export interface Ping {
  id: string;
  sender_id: string;
  recipient_id: string;
  message: string;
  read_at: string | null;
  created_at: string;
  sender?: {
    display_name: string | null;
    username: string | null;
  };
}

export function usePings(userId: string | null) {
  const supabase = useSupabase();
  const [pings, setPings] = useState<Ping[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchPings = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("pings")
      .select(
        `id, sender_id, recipient_id, message, read_at, created_at,
         sender:profiles!pings_sender_id_fkey(display_name, username)`
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const typedPings = data as unknown as Ping[];
      setPings(typedPings);
      setUnreadCount(typedPings.filter((p) => !p.read_at).length);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchPings();
  }, [fetchPings]);

  // Realtime subscription for new pings
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`pings-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pings",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          fetchPings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, fetchPings]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;

    const unreadIds = pings.filter((p) => !p.read_at).map((p) => p.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("pings")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    setPings((prev) =>
      prev.map((p) =>
        !p.read_at ? { ...p, read_at: new Date().toISOString() } : p
      )
    );
    setUnreadCount(0);
  }, [userId, supabase, pings]);

  const clearRead = useCallback(async () => {
    if (!userId) return;

    const readIds = pings.filter((p) => !!p.read_at).map((p) => p.id);
    if (readIds.length === 0) return;

    console.log("🗑️ Clearing", readIds.length, "read pings:", readIds);

    const { error } = await supabase
      .from("pings")
      .delete()
      .in("id", readIds);

    if (error) {
      console.error("❌ Failed to clear pings:", error);
      throw error;
    }

    console.log("✅ Pings cleared successfully");
    setPings((prev) => prev.filter((p) => !p.read_at));
  }, [userId, supabase, pings]);

  const sendPing = useCallback(
    async (recipientId: string, message: string) => {
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("pings").insert({
        sender_id: userId,
        recipient_id: recipientId,
        message,
      });

      if (error) throw error;
      void trackPodAccountabilityPingSent(supabase, userId, {
        recipient_id: recipientId,
        message_length: message.length,
        channel: "pings",
      });
    },
    [userId, supabase]
  );

  const deletePing = useCallback(
    async (pingId: string) => {
      if (!userId) return;

      const target = pings.find((p) => p.id === pingId);

      await supabase
        .from("pings")
        .delete()
        .eq("id", pingId);

      setPings((prev) => prev.filter((p) => p.id !== pingId));
      if (target && !target.read_at) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    },
    [userId, supabase, pings]
  );

  return {
    pings,
    unreadCount,
    loading,
    markAllRead,
    clearRead,
    sendPing,
    deletePing,
    refetch: fetchPings,
  };
}
