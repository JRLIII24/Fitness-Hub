"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSupabase } from "./use-supabase";

export type AppTheme = "default" | "pink" | "blue" | "custom";

const STORAGE_KEY = "fithub-color-theme";
const THEME_CLASSES: AppTheme[] = ["pink", "blue"];
const VALID_THEMES: AppTheme[] = ["default", "pink", "blue", "custom"];

function isThemePersistenceUnsupported(error: unknown): boolean {
  const e = (error ?? {}) as { code?: string; message?: string };
  const message = (e.message ?? "").toLowerCase();
  return (
    e.code === "42703" || // undefined_column
    e.code === "PGRST204" || // column not found in schema cache
    message.includes("theme_preference") ||
    message.includes("column") && message.includes("does not exist")
  );
}

function isValidTheme(value: string | null | undefined): value is AppTheme {
  return !!value && VALID_THEMES.includes(value as AppTheme);
}

function readStoredTheme(): AppTheme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(value) ? value : null;
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: AppTheme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Safari private mode and stricter privacy configs can throw here.
  }
}

function applyThemeClass(theme: AppTheme) {
  const html = document.documentElement;
  const body = document.body;

  THEME_CLASSES.forEach((t) => {
    html.classList.remove(`theme-${t}`);
    body?.classList.remove(`theme-${t}`);
  });

  if (theme === "pink" || theme === "blue") {
    html.classList.add(`theme-${theme}`);
    body?.classList.add(`theme-${theme}`);
  }
}

export function useAppTheme(userId: string | null) {
  const supabase = useSupabase();
  const [appTheme, setAppThemeState] = useState<AppTheme>("default");
  const [canPersistTheme, setCanPersistTheme] = useState(true);
  const lastLocalThemeChangeAt = useRef(0);
  const appThemeRef = useRef<AppTheme>("default");

  useEffect(() => {
    appThemeRef.current = appTheme;
  }, [appTheme]);

  // Apply from localStorage immediately on mount (no flash)
  useEffect(() => {
    const stored = readStoredTheme();
    if (stored) {
      setAppThemeState(stored);
      applyThemeClass(stored);
    }
  }, []);

  // Sync from DB once userId is known
  useEffect(() => {
    if (!userId) return;
    const requestStartedAt = Date.now();

    supabase
      .from("profiles")
      .select("theme_preference")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          if (isThemePersistenceUnsupported(error)) {
            setCanPersistTheme(false);
          }
          return;
        }

        const dbThemeRaw = data?.theme_preference as string | undefined;
        if (!isValidTheme(dbThemeRaw)) return;
        if (appThemeRef.current === "custom" && dbThemeRaw === "default") return;
        if (lastLocalThemeChangeAt.current > requestStartedAt) return;

        setAppThemeState(dbThemeRaw);
        applyThemeClass(dbThemeRaw);
        writeStoredTheme(dbThemeRaw);
      });
  }, [userId, supabase]);

  const setAppTheme = useCallback(
    async (newTheme: AppTheme) => {
      lastLocalThemeChangeAt.current = Date.now();
      setAppThemeState(newTheme);
      applyThemeClass(newTheme);
      writeStoredTheme(newTheme);
      if (userId && canPersistTheme) {
        const themePreferenceToPersist =
          newTheme === "custom" ? "default" : newTheme;

        const { error } = await supabase
          .from("profiles")
          .upsert(
            { id: userId, theme_preference: themePreferenceToPersist },
            { onConflict: "id" }
          );

        if (error) {
          if (isThemePersistenceUnsupported(error)) {
            setCanPersistTheme(false);
            return;
          }
          const e = error as { code?: string; message?: string; details?: string };
          console.warn(
            "Theme preference not persisted to DB",
            {
              code: e.code ?? "unknown",
              message: e.message ?? "unknown",
              details: e.details ?? "",
            }
          );
        }
      }
    },
    [userId, supabase, canPersistTheme]
  );

  return { appTheme, setAppTheme };
}
