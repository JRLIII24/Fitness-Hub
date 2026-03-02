import { useCallback, useState, useEffect } from "react";
import { useSupabase } from "./use-supabase";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

export type UnitPreference = "metric" | "imperial";

function isMissingUnitPreferenceColumnError(error: unknown): boolean {
  const message = ((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return message.includes("unit_preference") && message.includes("column");
}

export function useUnitPreference() {
  const supabase = useSupabase();
  const preference = useUnitPreferenceStore((state) => state.preference);
  const setPreference = useUnitPreferenceStore((state) => state.setPreference);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user || cancelled) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("unit_preference")
          .eq("id", user.id)
          .maybeSingle();

        if (fetchError) {
          if (!isMissingUnitPreferenceColumnError(fetchError)) {
            console.warn("Could not fetch unit_preference:", fetchError);
          }
          setError(null); // Keep local/store preference if DB read is unavailable.
        } else if (
          data?.unit_preference === "metric" ||
          data?.unit_preference === "imperial"
        ) {
          setPreference(data.unit_preference as UnitPreference);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to load unit preference:", err);
        if (!cancelled) setError("Could not load unit preference");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPreference();

    return () => {
      cancelled = true;
    };
  }, [supabase, setPreference]);

  const updatePreference = useCallback(
    async (newPreference: UnitPreference) => {
      const previousPreference = preference;

      try {
        setError(null);
        setPreference(newPreference); // Optimistic update for immediate UI consistency.

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Not authenticated");
        }

        const { error: upsertError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              unit_preference: newPreference,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (upsertError) {
          // If column doesn't exist, just set it locally
          if (isMissingUnitPreferenceColumnError(upsertError)) {
            console.warn("unit_preference column may not exist in database yet. Setting locally.");
          } else {
            throw upsertError;
          }
        }
      } catch (err) {
        setPreference(previousPreference);
        const message = err instanceof Error ? err.message : "Failed to update unit preference";
        console.error("Failed to update unit preference:", err);
        setError(message);
        throw err;
      }
    },
    [supabase, preference, setPreference]
  );

  const formatWeight = useCallback(
    (kg: number): string => {
      if (preference === "imperial") {
        const lbs = kg * 2.20462;
        return `${Math.round(lbs)} lbs`;
      }
      return `${Math.round(kg)} kg`;
    },
    [preference]
  );

  const unitLabel = preference === "imperial" ? "lbs" : "kg";

  return {
    preference,
    updatePreference,
    formatWeight,
    unitLabel,
    loading,
    error,
  };
}
