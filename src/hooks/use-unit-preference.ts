import { useCallback, useState, useEffect } from "react";
import { useSupabase } from "./use-supabase";

export type UnitPreference = "metric" | "imperial";

export function useUnitPreference() {
  const supabase = useSupabase();
  const [preference, setPreference] = useState<UnitPreference>("metric");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadPreference() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("profiles")
          .select("unit_preference")
          .eq("id", user.id)
          .single();

        if (fetchError) {
          console.warn("Could not fetch unit_preference (column may not exist yet):", fetchError);
          setError(null); // Don't show error to user, just use default
          setPreference("metric");
        } else if (data?.unit_preference) {
          setPreference(data.unit_preference as UnitPreference);
          setError(null);
        }
      } catch (err) {
        console.error("Failed to load unit preference:", err);
        setError("Could not load unit preference");
      } finally {
        setLoading(false);
      }
    }

    loadPreference();
  }, [supabase]);

  const updatePreference = useCallback(
    async (newPreference: UnitPreference) => {
      try {
        setError(null);
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Not authenticated");
        }

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ unit_preference: newPreference })
          .eq("id", user.id);

        if (updateError) {
          // If column doesn't exist, just set it locally
          if (updateError.message.includes("column") || updateError.message.includes("unit_preference")) {
            console.warn("unit_preference column may not exist in database yet. Setting locally.");
            setPreference(newPreference);
          } else {
            throw updateError;
          }
        } else {
          setPreference(newPreference);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update unit preference";
        console.error("Failed to update unit preference:", err);
        setError(message);
        throw err;
      }
    },
    [supabase]
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
