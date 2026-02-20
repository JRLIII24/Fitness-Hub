"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";

const STORAGE_KEY = "fithub-accent-color";
const CSS_KEYS = [
  "--primary",
  "--primary-foreground",
  "--ring",
  "--accent",
  "--accent-foreground",
  "--sidebar-primary",
  "--sidebar-primary-foreground",
  "--sidebar-ring",
  "--sidebar-accent",
  "--sidebar-accent-foreground",
];

function isValidHexColor(value: string | null | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

function isAccentPersistenceUnsupported(error: unknown): boolean {
  const e = (error ?? {}) as { code?: string; message?: string };
  const message = (e.message ?? "").toLowerCase();
  return (
    e.code === "42703" ||
    e.code === "PGRST204" ||
    message.includes("accent_color") ||
    (message.includes("column") && message.includes("does not exist"))
  );
}

function readStoredAccentColor(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isValidHexColor(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStoredAccentColor(color: string | null) {
  try {
    if (color) {
      localStorage.setItem(STORAGE_KEY, color);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures in stricter browser privacy modes.
  }
}

function hexToRgb(hex: string) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function getContrastForeground(hex: string): "#000000" | "#ffffff" {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

export function applyAccentColor(color: string | null) {
  const html = document.documentElement;

  if (!color) {
    CSS_KEYS.forEach((key) => html.style.removeProperty(key));
    return;
  }

  if (!isValidHexColor(color)) return;

  const foreground = getContrastForeground(color);

  html.style.setProperty("--primary", color);
  html.style.setProperty("--primary-foreground", foreground);
  html.style.setProperty("--ring", color);
  html.style.setProperty("--accent", color);
  html.style.setProperty("--accent-foreground", foreground);
  html.style.setProperty("--sidebar-primary", color);
  html.style.setProperty("--sidebar-primary-foreground", foreground);
  html.style.setProperty("--sidebar-ring", color);
  html.style.setProperty("--sidebar-accent", color);
  html.style.setProperty("--sidebar-accent-foreground", foreground);
}

export function useAccentColor(enabled = true, userId?: string | null) {
  const supabase = useSupabase();
  const [accentColor, setAccentColorState] = useState<string | null>(null);
  const [canPersistAccent, setCanPersistAccent] = useState(true);

  useEffect(() => {
    const stored = readStoredAccentColor();
    setAccentColorState(stored);
    applyAccentColor(enabled ? stored : null);
  }, [enabled]);

  useEffect(() => {
    if (!userId || !canPersistAccent) return;

    supabase
      .from("profiles")
      .select("accent_color")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          if (isAccentPersistenceUnsupported(error)) {
            setCanPersistAccent(false);
          }
          return;
        }

        const dbAccent = data?.accent_color;
        if (!isValidHexColor(dbAccent)) return;
        setAccentColorState(dbAccent);
        writeStoredAccentColor(dbAccent);
        applyAccentColor(enabled ? dbAccent : null);
      });
  }, [enabled, userId, supabase, canPersistAccent]);

  const persistAccentColor = useCallback(
    async (newColor: string | null) => {
      if (!userId || !canPersistAccent) return;
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: userId, accent_color: newColor }, { onConflict: "id" });

      if (error) {
        if (isAccentPersistenceUnsupported(error)) {
          setCanPersistAccent(false);
          return;
        }
        console.warn("Accent color preference not persisted to DB", {
          code: error.code ?? "unknown",
          message: error.message ?? "unknown",
        });
      }
    },
    [userId, canPersistAccent, supabase]
  );

  const setAccentColor = useCallback((newColor: string) => {
    if (!isValidHexColor(newColor)) return;
    setAccentColorState(newColor);
    applyAccentColor(enabled ? newColor : null);
    writeStoredAccentColor(newColor);
    void persistAccentColor(newColor);
  }, [enabled, persistAccentColor]);

  const clearAccentColor = useCallback(() => {
    setAccentColorState(null);
    applyAccentColor(null);
    writeStoredAccentColor(null);
    void persistAccentColor(null);
  }, [persistAccentColor]);

  return { accentColor, setAccentColor, clearAccentColor };
}
