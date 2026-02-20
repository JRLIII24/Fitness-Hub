"use client";

import { useTheme as useThemeHook } from "next-themes";

export function useTheme() {
  return useThemeHook();
}
