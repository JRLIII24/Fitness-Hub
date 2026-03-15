"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import { TrendingUp, Trophy, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/history/progress", label: "Progress", icon: TrendingUp },
  { href: "/history/prs", label: "PRs", icon: Trophy },
  { href: "/history/stats", label: "Stats", icon: BarChart3 },
] as const;

export function HistoryNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <LayoutGroup id="history-nav">
      <nav
        aria-label="History sections"
        className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none rounded-2xl border border-border/60 bg-card/40 p-1.5"
      >
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className="block shrink-0 select-none"
            >
              <motion.span
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative flex h-10 items-center gap-1 rounded-xl px-2.5 text-[11px] font-semibold transition-colors sm:gap-1.5 sm:px-3.5 sm:text-[12px]",
                  active ? "text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {active && (
                  <motion.span
                    layoutId="history-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-br from-primary to-primary/75 shadow-[0_2px_12px_hsl(var(--primary)/0.35)]"
                  />
                )}
                <Icon className={cn("relative z-[1] size-4", active ? "text-background" : "")} />
                <span className="relative z-[1]">{label}</span>
              </motion.span>
            </Link>
          );
        })}
      </nav>
    </LayoutGroup>
  );
}
