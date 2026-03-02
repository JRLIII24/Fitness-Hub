"use client";

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

function getDerivedUnitState(preference: UnitPreference) {
  return {
    splitDistanceM: preference === "imperial" ? 1609.34 : 1000,
    unitLabel: preference === "imperial" ? ("lbs" as const) : ("kg" as const),
    heightLabel: preference === "imperial" ? ("inches" as const) : ("cm" as const),
    distanceLabel: preference === "imperial" ? ("mi" as const) : ("km" as const),
    paceLabel: preference === "imperial" ? ("/mi" as const) : ("/km" as const),
  };
}

export const useUnitPreferenceStore = create<UnitPreferenceState>()(
  persist(
    (set, get) => ({
      preference: "metric",
      ...getDerivedUnitState("metric"),

      setPreference: (preference: UnitPreference) => {
        set({
          preference,
          ...getDerivedUnitState(preference),
        });
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

    }),
    {
      name: "fit-hub-unit-preference",
      // Only persist the preference value, not computed values
      partialize: (state) => ({ preference: state.preference }),
      // Avoid SSR/client hydration mismatch from localStorage-backed state.
      skipHydration: true,
      merge: (persistedState, currentState) => {
        const persistedPreference =
          (persistedState as Partial<UnitPreferenceState> | undefined)?.preference ?? "metric";
        const preference =
          persistedPreference === "imperial" || persistedPreference === "metric"
            ? persistedPreference
            : currentState.preference;

        return {
          ...currentState,
          preference,
          ...getDerivedUnitState(preference),
        };
      },
    }
  )
);
