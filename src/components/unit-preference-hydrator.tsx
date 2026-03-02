"use client";

import { useEffect } from "react";

import { useUnitPreferenceStore } from "@/stores/unit-preference-store";

export function UnitPreferenceHydrator() {
  useEffect(() => {
    if (useUnitPreferenceStore.persist.hasHydrated()) return;
    void useUnitPreferenceStore.persist.rehydrate();
  }, []);

  return null;
}
