"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert, Clock3, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/hooks/use-supabase";
import {
  logRetentionEvent,
  trackComebackPlanCompleted,
  trackComebackPlanStarted,
} from "@/lib/retention-events";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface MomentumProtectionCardProps {
  userId: string;
  urgency: "low" | "medium" | "high";
  workedOutYesterday: boolean;
  freezeAvailable: boolean;
}

export function MomentumProtectionCard({
  userId,
  urgency,
  workedOutYesterday,
  freezeAvailable,
}: MomentumProtectionCardProps) {
  const supabase = useSupabase();
  const router = useRouter();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `retention:momentum_protection_shown:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) {
      return;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(dedupeKey, "1");
    }

    void logRetentionEvent(supabase, {
      userId,
      eventType: "momentum_protection_shown",
      sourceScreen: "dashboard",
      metadata: {
        urgency,
        worked_out_yesterday: workedOutYesterday,
        freeze_available: freezeAvailable,
      },
    });
  }, [freezeAvailable, supabase, urgency, userId, workedOutYesterday]);

  async function handleUseFreeze() {
    try {
      const { data, error } = await supabase.rpc("use_streak_freeze", {
        user_id_param: userId,
      });
      if (error) throw error;

      if (data === true) {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_used",
          sourceScreen: "dashboard",
          metadata: { urgency },
        });
        void trackComebackPlanCompleted(supabase, userId, {
          channel: "streak_freeze",
          urgency,
        });
        toast.success("Streak freeze activated. Momentum protected for today.");
        router.refresh();
      } else {
        void logRetentionEvent(supabase, {
          userId,
          eventType: "streak_freeze_failed",
          sourceScreen: "dashboard",
          metadata: { reason: "not_available", urgency },
        });
        toast.error("No streak freeze available.");
      }
    } catch (err) {
      console.error("Failed to use streak freeze:", err);
      void logRetentionEvent(supabase, {
        userId,
        eventType: "streak_freeze_failed",
        sourceScreen: "dashboard",
        metadata: { reason: "rpc_error", urgency },
      });
      toast.error("Failed to activate streak freeze.");
    }
  }

  return (
    <Card
      className={`border ${
        urgency === "high"
          ? "border-rose-500/50 bg-rose-500/10"
          : urgency === "medium"
            ? "border-amber-500/50 bg-amber-500/10"
            : "border-primary/40 bg-primary/10"
      }`}
    >
      <CardContent className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
            Momentum Protection
          </p>
          <p className="mt-1 text-sm font-semibold">
            {urgency === "high"
              ? "Your streak is at risk tonight."
              : workedOutYesterday
                ? "Keep the streak alive with one focused session."
                : "A quick session today restores momentum."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {urgency === "high"
              ? "Log a workout now to avoid losing your current run."
              : "You are closer than you think. Protect the momentum."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {urgency === "high" ? (
            <ShieldAlert className="h-4 w-4 text-rose-400" />
          ) : (
            <Clock3 className="h-4 w-4 text-amber-400" />
          )}
          {freezeAvailable ? (
            <Button
              size="sm"
              variant="secondary"
              className="h-8 rounded-lg px-3 text-xs"
              onClick={handleUseFreeze}
            >
              <Snowflake className="mr-1.5 h-3.5 w-3.5" />
              Use Freeze
            </Button>
          ) : (
            <Link href="/workout">
              <Button
                size="sm"
                className="motion-press h-8 rounded-lg px-3 text-xs"
                onClick={() => {
                  void trackComebackPlanStarted(supabase, userId, {
                    channel: "start_workout",
                    urgency,
                  });
                }}
              >
                Protect
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
