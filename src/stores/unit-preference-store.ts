import { create } from "zustand";
import { persist } from "zustand/middleware";

type UnitPreference = "metric" | "imperial";

interface UnitPreferenceState {
  preference: UnitPreference;
  setPreference: (preference: UnitPreference) => void;
  formatWeight: (kg: number) => string;
  formatHeight: (cm: number) => string;
  unitLabel: "kg" | "lbs";
  heightLabel: "cm" | "inches";
}

export const useUnitPreferenceStore = create<UnitPreferenceState>()(
  persist(
    (set, get) => ({
      preference: "metric",

      setPreference: (preference: UnitPreference) => {
        set({ preference });
      },

      formatWeight: (kg: number) => {
        const state = get();
        if (state.preference === "imperial") {
          const lbs = kg * 2.20462;
          return `${Math.round(lbs)} lbs`;
        }
        return `${Math.round(kg)} kg`;
      },

      formatHeight: (cm: number) => {
        const state = get();
        if (state.preference === "imperial") {
          const inches = cm * 0.3937;
          return `${Math.round(inches * 10) / 10} inches`;
        }
        return `${Math.round(cm)} cm`;
      },

      get unitLabel() {
        return get().preference === "imperial" ? "lbs" : "kg";
      },

      get heightLabel() {
        return get().preference === "imperial" ? "inches" : "cm";
      },
    }),
    {
      name: "fit-hub-unit-preference",
      // Only persist the preference value, not computed values
      partialize: (state) => ({ preference: state.preference }),
    }
  )
);
