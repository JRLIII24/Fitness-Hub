"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TRAIN_TABS = [
  { href: "/workout", label: "Workout", exact: true },
  { href: "/programs", label: "Programs", exact: false },
  { href: "/templates", label: "Templates", exact: false },
  { href: "/workout/calendar", label: "Calendar", exact: false },
] as const;

export function TrainSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Training sections"
      className="flex rounded-full border border-border/60 bg-muted/40 p-1 backdrop-blur-sm"
    >
      {TRAIN_TABS.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "min-h-9 flex-1 rounded-full px-3 text-center text-xs font-medium leading-9 transition-all duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
