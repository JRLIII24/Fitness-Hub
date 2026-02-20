"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Dumbbell,
  Apple,
  Users,
  Clapperboard,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePings } from "@/hooks/use-pings";
import { useSharedItems } from "@/hooks/use-shared-items";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkoutStore } from "@/stores/workout-store";

export function BottomNav() {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const isWorkoutActive = useWorkoutStore((state) => state.isWorkoutActive);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, [supabase]);

  const { unreadCount: pingsUnread } = usePings(userId);
  const { unreadCount: sharedUnread } = useSharedItems(userId);
  const unreadCount = pingsUnread + sharedUnread;

  // Focus Mode: hide bottom nav while an active workout is in progress
  if (pathname.startsWith("/workout") && isWorkoutActive) {
    return null;
  }

  const navLink = (
    href: string,
    label: string,
    Icon: React.ElementType,
    badge?: number
  ) => {
    const isActive = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
          isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <span className="relative">
          <Icon className="size-5" />
          {badge != null && badge > 0 && (
            <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className="truncate">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center px-2 sm:px-4">

        {navLink("/dashboard", "Home", LayoutDashboard)}
        {navLink("/workout", "Workout", Dumbbell)}

        {/* Post FAB — raised, occupies same flex-1 slot as other items */}
        <Link
          href="/sets/upload"
          className="flex flex-1 flex-col items-center gap-0.5 py-2"
          aria-label="Post a Set"
        >
          <span className="flex size-12 -translate-y-3 items-center justify-center rounded-full bg-primary shadow-lg shadow-primary/40 transition-transform active:scale-95">
            <Plus className="size-6 text-primary-foreground" />
          </span>
          <span className="text-[10px] text-muted-foreground -mt-2">Post</span>
        </Link>

        {/* Sets feed */}
        <Link
          href="/sets"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors",
            pathname.startsWith("/sets")
              ? "text-primary"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Clapperboard className="size-5" />
          <span className="truncate">Forge</span>
        </Link>

        {navLink("/nutrition", "Nutrition", Apple)}
        {navLink("/social", "Social", Users, unreadCount)}

      </div>
      {/* Safe area padding for iOS home indicator */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
