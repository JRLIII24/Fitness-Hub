import { create } from "zustand";
import { persist } from "zustand/middleware";

type UnitPreference = "metric" | "imperial";

interface UnitPreferenceState {
  preference: UnitPreference;
  setPreference: (preference: UnitPreference) => void;
  formatWeight: (kg: number) => string;
  formatHeight: (cm: number) => string;
  formatDistance: (meters: number) => string;
  formatPace: (secPerKm: number) => string;
  formatElevation: (meters: number) => string;
  splitDistanceM: number;
  unitLabel: "kg" | "lbs";
  heightLabel: "cm" | "inches";
  distanceLabel: "mi" | "km";
  paceLabel: "/mi" | "/km";
}

export const useUnitPreferenceStore = create<UnitPreferenceState>()(
  persist(
    (set, get) => ({
      preference: "imperial",

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

      formatDistance: (meters: number) => {
        const state = get();
        if (state.preference === "imperial") {
          const miles = meters * 0.000621371;
          return `${miles.toFixed(2)} mi`;
        }
        const km = meters / 1000;
        return `${km.toFixed(2)} km`;
      },

      formatPace: (secPerKm: number) => {
        if (secPerKm <= 0) return "--:--";
        const state = get();
        const totalSec = state.preference === "imperial" ? secPerKm * 1.60934 : secPerKm;
        const min = Math.floor(totalSec / 60);
        const sec = Math.round(totalSec % 60);
        const label = state.preference === "imperial" ? "/mi" : "/km";
        return `${min}:${sec.toString().padStart(2, "0")} ${label}`;
      },

      formatElevation: (meters: number) => {
        const state = get();
        if (state.preference === "imperial") {
          const ft = meters * 3.28084;
          return `${Math.round(ft)} ft`;
        }
        return `${Math.round(meters)} m`;
      },

      get splitDistanceM() {
        return get().preference === "imperial" ? 1609.34 : 1000;
      },

      get unitLabel() {
        return get().preference === "imperial" ? "lbs" : "kg";
      },

      get heightLabel() {
        return get().preference === "imperial" ? "inches" : "cm";
      },

      get distanceLabel() {
        return get().preference === "imperial" ? "mi" : "km";
      },

      get paceLabel() {
        return get().preference === "imperial" ? "/mi" : "/km";
      },
    }),
    {
      name: "fit-hub-unit-preference",
      // Only persist the preference value, not computed values
      partialize: (state) => ({ preference: state.preference }),
    }
  )
);
