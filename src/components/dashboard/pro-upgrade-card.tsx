"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, Sparkles, LineChart, ShieldCheck } from "lucide-react";
import { useSupabase } from "@/hooks/use-supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProUpgradeCardProps {
  userId: string;
}

export function ProUpgradeCard({ userId }: ProUpgradeCardProps) {
  const supabase = useSupabase();

  useEffect(() => {
    const dayKey = new Date().toISOString().slice(0, 10);
    const dedupeKey = `conversion:pro_upgrade_card:${dayKey}`;
    if (typeof window !== "undefined" && window.localStorage.getItem(dedupeKey)) return;
    if (typeof window !== "undefined") window.localStorage.setItem(dedupeKey, "1");

    void supabase.from("conversion_impressions").insert({
      user_id: userId,
      placement: "dashboard",
      impression_type: "locked_preview",
      variant: "pro_card_v1",
      metadata: {
        module: "analytics_and_coaching",
      },
    });
  }, [supabase, userId]);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card/85">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lock className="h-4 w-4 text-primary" />
          Pro Performance Layer
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          You&apos;ve built momentum. Unlock coaching-grade trend models and pod competition analytics.
        </p>
        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <LineChart className="h-3.5 w-3.5 text-primary" />
            <span>Advanced PR trajectory forecasting</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>Accountability pod pressure index</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/25 px-2.5 py-2">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>Adaptive fueling recommendations</span>
          </div>
        </div>
        <Link href="/settings" className="block">
          <Button className="motion-press w-full" size="sm">
            Unlock Pro Preview
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
