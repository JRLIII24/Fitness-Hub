"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { ReactNode } from "react";
import { UnitPreferenceHydrator } from "@/components/unit-preference-hydrator";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <UnitPreferenceHydrator />
      {children}
    </NextThemesProvider>
  );
}
