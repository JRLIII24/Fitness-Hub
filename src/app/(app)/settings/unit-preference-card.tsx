"use client";

import { useEffect } from "react";
import { Globe } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "metric" as const, label: "Metric", sub: "kg · cm · km" },
  { value: "imperial" as const, label: "Imperial", sub: "lbs · in · mi" },
];

export function UnitPreferenceCard() {
  const { preference, setPreference } = useUnitPreferenceStore();

  // Hydrate persisted store on mount
  useEffect(() => {
    useUnitPreferenceStore.persist.rehydrate();
  }, []);

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Globe className="h-4 w-4 text-primary" />
          Units
        </CardTitle>
        <CardDescription className="text-xs">
          Choose your preferred measurement system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPreference(opt.value)}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                preference === opt.value
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-muted/20 hover:bg-muted/40"
              )}
            >
              <p className={cn("text-sm font-semibold", preference === opt.value ? "text-primary" : "text-foreground")}>
                {opt.label}
              </p>
              <p className="text-[11px] text-muted-foreground">{opt.sub}</p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
