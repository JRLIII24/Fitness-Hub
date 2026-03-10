"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TrendlineData {
  weights: number[]; // chronological order (oldest → newest)
  slope: number;
}

/**
 * Fetches the last 3 top-set weights per exercise using the
 * get_exercise_trendlines RPC. Stable memoized output — only
 * re-fetches when userId or exerciseIds reference changes.
 *
 * Only runs when isActive is true to avoid wasted fetches on the setup screen.
 */
export function useExerciseTrendlines(
  exerciseIds: string[],
  userId: string | null,
  isActive: boolean
): Record<string, TrendlineData> {
  const supabase = useMemo(() => createClient(), []);
  const [trendlines, setTrendlines] = useState<Record<string, TrendlineData>>({});

  // Stable reference for exerciseIds to avoid effect re-runs on every render
  const idsKey = exerciseIds.slice().sort().join(",");
  const idsKeyRef = useRef(idsKey);
  idsKeyRef.current = idsKey;

  useEffect(() => {
    if (!isActive || !userId || exerciseIds.length === 0) {
      setTrendlines({});
      return;
    }

    let cancelled = false;

    async function fetch() {
      const { data, error } = await supabase.rpc("get_exercise_trendlines", {
        p_user_id: userId!,
        p_exercise_ids: exerciseIds,
      });

      if (cancelled || error || !data) return;

      // Group by exercise_id; rows come back with session_rank 1=most recent
      const grouped: Record<string, Array<{ rank: number; weight: number }>> = {};
      for (const row of data as Array<{
        exercise_id: string;
        session_rank: number;
        top_set_weight_kg: number;
      }>) {
        if (!grouped[row.exercise_id]) grouped[row.exercise_id] = [];
        grouped[row.exercise_id].push({
          rank: row.session_rank,
          weight: row.top_set_weight_kg,
        });
      }

      const result: Record<string, TrendlineData> = {};
      for (const [exId, rows] of Object.entries(grouped)) {
        // Sort ascending by rank so index 0 = oldest, last = newest
        const sorted = rows.sort((a, b) => b.rank - a.rank);
        const weights = sorted.map((r) => r.weight);
        const slope =
          weights.length >= 2
            ? (weights[weights.length - 1] - weights[0]) / (weights.length - 1)
            : 0;
        result[exId] = { weights, slope };
      }

      setTrendlines(result);
    }

    fetch();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, userId, idsKey, supabase]);

  return trendlines;
}
