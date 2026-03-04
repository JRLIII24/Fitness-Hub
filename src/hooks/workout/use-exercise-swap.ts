import { useCallback, useState } from "react";
import type { Exercise } from "@/types/workout";

/**
 * Manages exercise swap state (which exercise index has the swap sheet open)
 * and coordinates the swap action with targeted ghost refetch.
 */
export function useExerciseSwap(
  swapExerciseInStore: (exerciseIndex: number, newExercise: Exercise) => void,
  patchGhostForExercise: (exerciseId: string) => Promise<void>
) {
  const [swapSheetIndex, setSwapSheetIndex] = useState<number | null>(null);

  const handleSwapExercise = useCallback(
    async (exerciseIndex: number, newExercise: Exercise) => {
      // 1. Swap in the store (resets weights, keeps set structure)
      swapExerciseInStore(exerciseIndex, newExercise);

      // 2. Targeted ghost re-fetch for the new exercise only
      await patchGhostForExercise(newExercise.id);
    },
    [swapExerciseInStore, patchGhostForExercise]
  );

  return {
    swapSheetIndex,
    setSwapSheetIndex,
    handleSwapExercise,
  };
}
