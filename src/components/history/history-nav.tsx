"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { CalendarDays, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/history", label: "Calendar", icon: CalendarDays },
  { href: "/history/progress", label: "Progress", icon: TrendingUp },
] as const;

export function HistoryNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/history") return pathname === "/history";
    return pathname.startsWith(href);
  }

  return (
    <LayoutGroup id="history-nav">
      <nav
        aria-label="History sections"
        className="inline-flex items-center gap-1 rounded-xl border border-border/60 bg-card/50 p-1"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="block"
            >
              <motion.span
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="history-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-primary/75 shadow-[0_2px_12px_hsl(var(--primary)/0.35)]"
                  />
                )}
                <Icon className={cn("relative z-[1] size-3.5", active ? "text-background" : "")} />
                <span className="relative z-[1]">{label}</span>
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
