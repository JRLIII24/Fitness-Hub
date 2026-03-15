"use client";

import { motion } from "framer-motion";
import { Y2K } from "@/lib/pods/y2k-tokens";

interface Tab {
  id: string;
  label: string;
}

interface Y2KTabsProps<T extends string> {
  tabs: readonly Tab[] | readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  accent?: string; // Override accent color (defaults to cyan)
}

export function Y2KTabs<T extends string>({
  tabs,
  active,
  onChange,
  accent = Y2K.cyan,
}: Y2KTabsProps<T>) {
  return (
    <div
      className="flex"
      style={{
        background: "rgba(0,0,0,0.40)",
        borderRadius: Y2K.rFull,
        border: `1px solid ${Y2K.border1}`,
        padding: "2px",
        gap: "2px",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id as T)}
            style={{
              position: "relative",
              flex: 1,
              padding: "6px 8px",
              border: "none",
              background: "transparent",
              color: isActive ? accent : Y2K.text2,
              fontFamily: Y2K.fontDisplay,
              fontSize: "9px",
              fontWeight: 900,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              cursor: "pointer",
              borderRadius: Y2K.rFull,
              transition: "color 0.15s",
            }}
          >
            {tab.label}
            {isActive && (
              <motion.div
                layoutId="y2k-tab-indicator"
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: "20%",
                  right: "20%",
                  height: "2px",
                  background: accent,
                  borderRadius: "1px",
                }}
                transition={Y2K.snappy}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/** @deprecated Use Y2KTabs instead */
export const TacxTabs = Y2KTabs;
