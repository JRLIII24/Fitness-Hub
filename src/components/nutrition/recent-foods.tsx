"use client";

import { useState, useEffect } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodResultCard } from "./food-result-card";
import type { FoodItem } from "@/types/nutrition";

export function RecentFoods({ onFound }: { onFound: (food: FoodItem) => void }) {
  const [recentFoods, setRecentFoods] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useSupabase();

  useEffect(() => {
    async function loadRecentFoods() {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setRecentFoods([]);
          return;
        }

        const { data } = await supabase
          .from("food_log")
          .select(
            "logged_at, food_items(id, name, brand, calories_per_serving, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, serving_description, serving_size_g, barcode, source)"
          )
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(40);

        const typed = (data ?? []) as Array<{
          logged_at: string;
          food_items: FoodItem | FoodItem[] | null;
        }>;

        const seen = new Set<string>();
        const deduped: FoodItem[] = [];

        for (const row of typed) {
          const food = Array.isArray(row.food_items)
            ? row.food_items[0] ?? null
            : row.food_items;
          if (!food) continue;
          if (seen.has(food.id)) continue;
          seen.add(food.id);
          deduped.push(food);
          if (deduped.length >= 8) break;
        }

        setRecentFoods(deduped);
      } finally {
        setLoading(false);
      }
    }

    loadRecentFoods();
  }, [supabase]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recently Logged
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading recent foods...</p>
        </CardContent>
      </Card>
    );
  }

  if (recentFoods.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Recently Logged
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {recentFoods.map((food) => (
          <button
            key={food.id}
            className="w-full text-left transition-opacity hover:opacity-80 active:opacity-60"
            onClick={() => onFound(food)}
          >
            <FoodResultCard food={food} />
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
