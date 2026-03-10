"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion } from "framer-motion";
import {
  LayoutDashboard,
  Dumbbell,
  Apple,
  Users,
  ScanLine,
  Settings,
  Store,
  Target,
  Calendar,
} from "lucide-react";
import type { ElementType } from "react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkoutStore } from "@/stores/workout-store";
import { MARKETPLACE_ENABLED } from "@/lib/features";

export function BottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const isWorkoutActive = useWorkoutStore((state) => state.isWorkoutActive);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, [supabase]);

  useEffect(() => {
    if (!userId) return;

    let isActive = true;

    async function refreshUnreadCount() {
      const [{ count: pingsCount }, { count: sharedCount }] = await Promise.all([
        supabase
          .from("pings")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId!)
          .is("read_at", null),
        supabase
          .from("shared_items")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", userId!)
          .is("read_at", null),
      ]);

      if (!isActive) return;
      setUnreadCount((pingsCount ?? 0) + (sharedCount ?? 0));
    }

    void refreshUnreadCount();

    const pingsChannel = supabase
      .channel(`nav-pings-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pings", filter: `recipient_id=eq.${userId}` },
        () => {
          void refreshUnreadCount();
        }
      )
      .subscribe();

    const sharedItemsChannel = supabase
      .channel(`nav-shared-items-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shared_items", filter: `recipient_id=eq.${userId}` },
        () => {
          void refreshUnreadCount();
        }
      )
      .subscribe();

    return () => {
      isActive = false;
      supabase.removeChannel(pingsChannel);
      supabase.removeChannel(sharedItemsChannel);
    };
  }, [supabase, userId]);

  type NavTab = {
    href: string;
    label: string;
    icon: ElementType;
    badge?: number;
    pulse?: boolean;
  };

  const tabs: NavTab[] = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    {
      href: "/workout",
      label: isWorkoutActive && !pathname.startsWith("/workout") ? "Resume" : "Workout",
      icon: Dumbbell,
      pulse: isWorkoutActive,
    },
    { href: "/workout/form-check", label: "Form", icon: ScanLine },
    { href: "/nutrition", label: "Nutrition", icon: Apple },
    { href: "/pods", label: "Pods", icon: Target },
    { href: "/social", label: "Social", icon: Users, badge: unreadCount },
    ...(MARKETPLACE_ENABLED ? [{ href: "/marketplace", label: "Templates", icon: Store }] : []),
    { href: "/programs", label: "Programs", icon: Calendar },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isTabActive = (href: string) => {
    if (href === "/dashboard") return pathname.startsWith("/dashboard");
    // If a more specific tab owns this path, don't mark the parent as active.
    const superseded = tabs.some(
      (t) => t.href !== href && t.href.startsWith(href + "/") && pathname.startsWith(t.href)
    );
    if (superseded) return false;
    return pathname.startsWith(href);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav border-t border-[rgba(255,255,255,0.09)] shadow-[0_-8px_32px_rgba(0,0,0,0.60)]">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-center px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        <LayoutGroup id="bottom-nav">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none rounded-full border border-border/70 glass-inner p-1 sm:gap-1">
            {tabs.map((tab) => {
              const isActive = isTabActive(tab.href);
              const Icon = tab.icon;
              return (
                <Link key={tab.href} href={tab.href} className="block shrink-0" aria-label={tab.label}>
                  <motion.span
                    whileTap={{ scale: 0.94 }}
                    className={cn(
                      "relative flex items-center gap-1 rounded-full px-2 py-2 text-[12px] sm:gap-1.5 sm:px-3.5",
                      isActive ? "text-background" : "text-muted-foreground"
                    )}
                  >
                    {isActive ? (
                      <motion.span
                        layoutId="nav-active-pill"
                        transition={{ type: "spring", stiffness: 400, damping: 34, mass: 0.8 }}
                        className="absolute inset-0 rounded-full bg-gradient-to-br from-[var(--phase-current-accent,var(--primary))] to-[var(--phase-current-accent,var(--primary))]/70 shadow-[0_2px_14px_var(--phase-current-glow,oklch(0.98_0_0_/_0.32))]"
                      />
                    ) : null}

                    <span className="relative z-[1]">
                      <Icon className={cn("size-4", isActive ? "text-background" : "text-muted-foreground")} />
                      {tab.pulse ? (
                        <span className="absolute -left-1 -top-1 h-2 w-2 animate-pulse rounded-full bg-primary" />
                      ) : null}
                      {tab.badge != null && tab.badge > 0 ? (
                        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                          {tab.badge > 9 ? "9+" : tab.badge}
                        </span>
                      ) : null}
                    </span>

                    <motion.span
                      animate={{
                        opacity: isActive ? 1 : 0,
                        width: isActive ? "auto" : 0,
                        marginLeft: isActive ? 0 : -6,
                      }}
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className={cn(
                        "relative z-[1] overflow-hidden whitespace-nowrap font-semibold",
                        isActive ? "text-background" : "text-muted-foreground"
                      )}
                    >
                      {tab.label}
                    </motion.span>
                  </motion.span>
                </Link>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </nav>
  );
}
