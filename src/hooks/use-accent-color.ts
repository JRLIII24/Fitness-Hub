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

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, "0")}${clamp(g).toString(16).padStart(2, "0")}${clamp(b).toString(16).padStart(2, "0")}`;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    const v = Math.round(l * 255);
    return { r: v, g: v, b: v };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Clamp the color's lightness so it stays visible on both dark surfaces
 * (the app background) and light surfaces (the default button gradient).
 *
 * Dark mode: lightness between 0.35–0.75
 *   - Too light (e.g. white) → invisible on the white default-button bg
 *   - Too dark (e.g. black) → invisible on dark app background
 *
 * Light mode: lightness between 0.30–0.60
 *   - Ensures adequate contrast on light backgrounds
 */
function ensureContrastSafe(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);

  const isDark = document.documentElement.classList.contains("dark");

  const minL = isDark ? 0.35 : 0.30;
  const maxL = isDark ? 0.75 : 0.60;

  // If lightness is within range, return original
  if (l >= minL && l <= maxL) return hex;

  const clampedL = Math.max(minL, Math.min(maxL, l));
  // Boost saturation slightly when clamping to preserve color vibrancy
  const adjustedS = Math.min(1, s * 1.1);
  const clamped = hslToRgb(h, adjustedS, clampedL);
  return rgbToHex(clamped.r, clamped.g, clamped.b);
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

  // Adjust color lightness to ensure contrast on all surfaces
  const safeColor = ensureContrastSafe(color);
  const foreground = getContrastForeground(safeColor);

  html.style.setProperty("--primary", safeColor);
  html.style.setProperty("--primary-foreground", foreground);
  html.style.setProperty("--ring", safeColor);
  html.style.setProperty("--accent", safeColor);
  html.style.setProperty("--accent-foreground", foreground);
  html.style.setProperty("--sidebar-primary", safeColor);
  html.style.setProperty("--sidebar-primary-foreground", foreground);
  html.style.setProperty("--sidebar-ring", safeColor);
  html.style.setProperty("--sidebar-accent", safeColor);
  html.style.setProperty("--sidebar-accent-foreground", foreground);
}

export function useAccentColor(enabled = true, userId?: string | null) {
  const supabase = useSupabase();
  const [accentColor, setAccentColorState] = useState<string | null>(null);
  const [canPersistAccent, setCanPersistAccent] = useState(true);

  // Hydration-safe: read localStorage only after mount
  useEffect(() => {
    const stored = readStoredAccentColor();
    if (stored) {
      setAccentColorState(stored);
    }
  }, []);

  useEffect(() => {
    applyAccentColor(enabled ? accentColor : null);
  }, [enabled, accentColor]);

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
