"use client";

import { useState, useEffect } from "react";

/**
 * Reads the resolved value of the CSS `--primary` custom property from
 * <html> and re-runs whenever the theme class list or inline style changes
 * (e.g. accent color set, pink/blue theme applied).
 *
 * Returns a CSS color string suitable for use in `boxShadow`, `color`, etc.
 * Falls back to "hsl(var(--primary))" during SSR / before hydration.
 */
export function usePrimaryColor(): string {
    const [color, setColor] = useState<string>("hsl(var(--primary))");

    useEffect(() => {
        function read() {
            const raw = getComputedStyle(document.documentElement)
                .getPropertyValue("--primary")
                .trim();
            // The value may be an oklch() string, a hex, or an hsl string.
            // Wrap it in the appropriate function only if it's a raw token list.
            if (!raw) {
                setColor("hsl(var(--primary))");
                return;
            }
            // If already a full color value (starts with # or contains "(") use as-is.
            if (raw.startsWith("#") || raw.includes("(")) {
                setColor(raw);
            } else {
                // It's a space-separated hsl channel list like "0.98 0 0" — treat as-is
                // but wrap so CSS understands it.
                setColor(`oklch(${raw})`);
            }
        }

        read();

        // Watch for class or style attribute changes on <html> (theme switches).
        const observer = new MutationObserver(read);
        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class", "style"],
        });

        return () => observer.disconnect();
    }, []);

    return color;
}
