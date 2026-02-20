"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "./use-supabase";

export interface TemplateSnapshot {
  name: string;
  description: string | null;
  exercises: Array<{
    name: string;
    muscle_group: string;
    sets: Array<{ reps: number | null; weight_kg: number | null }>;
  }>;
}

export interface MealDaySnapshot {
  date: string;
  totals: {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
    fiber_g: number;
    sugar_g?: number;
    sodium_mg?: number;
  };
  meals: {
    breakfast: MealEntry[];
    lunch: MealEntry[];
    dinner: MealEntry[];
    snack: MealEntry[];
  };
}

export interface MealEntry {
  name: string;
  brand: string | null;
  servings: number;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface SharedItem {
  id: string;
  sender_id: string;
  recipient_id: string;
  item_type: "template" | "meal_day";
  template_id: string | null;
  item_snapshot: TemplateSnapshot | MealDaySnapshot;
  message: string | null;
  read_at: string | null;
  created_at: string;
  sender?: {
    display_name: string | null;
    username: string | null;
  };
}

export function useSharedItems(userId: string | null) {
  const supabase = useSupabase();
  const [items, setItems] = useState<SharedItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!userId) return;

    const { data, error } = await supabase
      .from("shared_items")
      .select(
        `id, sender_id, recipient_id, item_type, template_id, item_snapshot, message, read_at, created_at,
         sender:profiles!shared_items_sender_id_fkey(display_name, username)`
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!error && data) {
      const typed = data as unknown as SharedItem[];
      setItems(typed);
      setUnreadCount(typed.filter((i) => !i.read_at).length);
    }
    setLoading(false);
  }, [userId, supabase]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`shared-items-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "shared_items",
          filter: `recipient_id=eq.${userId}`,
        },
        () => fetchItems()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, supabase, fetchItems]);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    const unreadIds = items.filter((i) => !i.read_at).map((i) => i.id);
    if (unreadIds.length === 0) return;

    await supabase
      .from("shared_items")
      .update({ read_at: new Date().toISOString() })
      .in("id", unreadIds);

    setItems((prev) =>
      prev.map((i) => (!i.read_at ? { ...i, read_at: new Date().toISOString() } : i))
    );
    setUnreadCount(0);
  }, [userId, supabase, items]);

  const clearRead = useCallback(async () => {
    if (!userId) return;

    const readIds = items.filter((i) => !!i.read_at).map((i) => i.id);
    if (readIds.length === 0) return;

    console.log("🗑️ Clearing", readIds.length, "read shared items:", readIds);

    const { error } = await supabase
      .from("shared_items")
      .delete()
      .in("id", readIds);

    if (error) {
      console.error("❌ Failed to clear shared items:", error);
      throw error;
    }

    console.log("✅ Shared items cleared successfully");
    setItems((prev) => prev.filter((i) => !i.read_at));
  }, [userId, supabase, items]);

  const clearItem = useCallback(async (itemId: string) => {
    if (!userId) return;

    const target = items.find((i) => i.id === itemId) ?? null;

    await supabase
      .from("shared_items")
      .delete()
      .eq("id", itemId);

    setItems((prev) => prev.filter((i) => i.id !== itemId));
    if (target && !target.read_at) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, [userId, supabase, items]);

  const sendTemplate = useCallback(
    async (
      recipientId: string,
      template: { id: string; name: string; description: string | null; exercises: TemplateSnapshot["exercises"] },
      message?: string
    ) => {
      if (!userId) throw new Error("Not authenticated");

      const snapshot: TemplateSnapshot = {
        name: template.name,
        description: template.description,
        exercises: template.exercises,
      };

      const { error } = await supabase.from("shared_items").insert({
        sender_id: userId,
        recipient_id: recipientId,
        item_type: "template",
        template_id: template.id,
        item_snapshot: snapshot,
        message: message || null,
      });

      if (error) throw error;
    },
    [userId, supabase]
  );

  const sendMealDay = useCallback(
    async (
      recipientId: string,
      snapshot: MealDaySnapshot,
      message?: string
    ) => {
      if (!userId) throw new Error("Not authenticated");

      const { error } = await supabase.from("shared_items").insert({
        sender_id: userId,
        recipient_id: recipientId,
        item_type: "meal_day",
        template_id: null,
        item_snapshot: snapshot,
        message: message || null,
      });

      if (error) throw error;
    },
    [userId, supabase]
  );

  return {
    items,
    unreadCount,
    loading,
    markAllRead,
    clearRead,
    clearItem,
    sendTemplate,
    sendMealDay,
    refetch: fetchItems,
  };
}
