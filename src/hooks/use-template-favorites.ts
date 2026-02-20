"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "./use-supabase";

export function useTemplateFavorites(userId: string | null) {
  const supabase = useSupabase();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    supabase
      .from("template_favorites")
      .select("template_id")
      .eq("user_id", userId)
      .then(({ data }) => {
        setFavoriteIds(new Set((data ?? []).map((r) => r.template_id)));
        setLoading(false);
      });
  }, [userId, supabase]);

  const toggleFavorite = useCallback(
    async (templateId: string) => {
      if (!userId) return;
      const isFav = favoriteIds.has(templateId);

      // Optimistic
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (isFav) {
          next.delete(templateId);
        } else {
          next.add(templateId);
        }
        return next;
      });

      if (isFav) {
        const { error } = await supabase
          .from("template_favorites")
          .delete()
          .eq("user_id", userId)
          .eq("template_id", templateId);

        if (error) {
          // Rollback
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.add(templateId);
            return next;
          });
        }
      } else {
        const { error } = await supabase
          .from("template_favorites")
          .insert({ user_id: userId, template_id: templateId });

        if (error) {
          // Rollback
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(templateId);
            return next;
          });
        }
      }
    },
    [userId, favoriteIds, supabase]
  );

  return { favoriteIds, loading, toggleFavorite };
}
