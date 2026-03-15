"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkoutPresence } from "@/hooks/use-workout-presence";

/**
 * Mounts the workout presence broadcast hook.
 * Renders nothing — purely a side-effect component.
 */
export function WorkoutPresenceProvider() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setUserId(user.id);
      });
  }, []);

  useWorkoutPresence(userId);

  return null;
}
