"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StreakBadge } from "./streak-badge";
import { LevelUpCelebration } from "./level-up-celebration";
import { useSupabase } from "@/hooks/use-supabase";
import { toast } from "sonner";

interface StreakSectionProps {
  userId: string;
  currentStreak: number;
  milestonesUnlocked: number[];
  freezeAvailable: boolean;
  level: number;
}

export function StreakSection({
  userId,
  currentStreak,
  milestonesUnlocked,
  freezeAvailable,
  level,
}: StreakSectionProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [newLevel, setNewLevel] = useState(level);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });

      if (error) throw error;

      if (data) {
        toast.success("Streak freeze activated! Your streak is protected for today.");
        router.refresh();
      } else {
        toast.error("No streak freeze available");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      toast.error("Failed to activate streak freeze");
    }
  }

  return (
    <>
      <StreakBadge
        currentStreak={currentStreak}
        milestonesUnlocked={milestonesUnlocked}
        freezeAvailable={freezeAvailable}
        onUseFreeze={handleUseFreeze}
        className="mt-1"
      />

      {showLevelUp && (
        <LevelUpCelebration
          newLevel={newLevel}
          onClose={() => setShowLevelUp(false)}
        />
      )}
    </>
  );
}
