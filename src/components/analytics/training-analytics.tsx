"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import {
  TrendingUp,
  Radar,
  Scale,
} from "lucide-react";
import type { AnalyticsVolumeResponse } from "@/app/api/analytics/volume/route";

const NutritionTrendCharts = dynamic(
  () =>
    import("@/components/analytics/nutrition-trend-charts").then(
      (m) => m.NutritionTrendCharts
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={460} />,
  }
);

// Dynamic imports for Recharts-based chart components (avoid SSR issues)
const VolumePeriodizationChart = dynamic(
  () =>
    import("@/components/charts/volume-periodization-chart").then(
      (m) => m.VolumePeriodizationChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={220} />,
  }
);

const MuscleBalanceRadar = dynamic(
  () =>
    import("@/components/charts/muscle-balance-radar").then(
      (m) => m.MuscleBalanceRadar
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={260} />,
  }
);

const BodyCompositionChart = dynamic(
  () =>
    import("@/components/charts/body-composition-chart").then(
      (m) => m.BodyCompositionChart
    ),
  {
    ssr: false,
    loading: () => <ChartSkeleton height={220} />,
  }
);

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex items-center justify-center text-[13px] text-muted-foreground"
      style={{ height }}
    >
      Loading chart...
    </div>
  );
}

interface WeightLog {
  id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
}

export function TrainingAnalytics() {
  const router = useRouter();
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [volumeData, setVolumeData] =
    useState<AnalyticsVolumeResponse | null>(null);
  const [weightData, setWeightData] = useState<WeightLog[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      const [volRes, weightRes] = await Promise.all([
        fetch("/api/analytics/volume?weeks=12"),
        fetch("/api/body/weight?limit=365"),
      ]);

      if (volRes.status === 401 || weightRes.status === 401) {
        router.push("/login");
        return;
      }

      const volJson = volRes.ok ? await volRes.json() : null;
      const weightJson = weightRes.ok ? await weightRes.json() : null;

      if (active) {
        setVolumeData(volJson);
        setWeightData(weightJson);
        setLoading(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-5">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[300px] animate-pulse rounded-2xl border border-border/60 bg-card/30"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Volume Periodization */}
      <div className="rounded-2xl border border-border/60 bg-card/30">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-bold">Volume Periodization</span>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Last 12 weeks
          </span>
        </div>
        <div className="h-px bg-border/40" />
        <div className="p-5">
          <VolumePeriodizationChart
            data={volumeData?.weekly_volume ?? []}
            isImperial={isImperial}
          />
        </div>
      </div>

      {/* Muscle Balance Radar */}
      <div className="rounded-2xl border border-border/60 bg-card/30">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Radar className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-bold">Muscle Balance</span>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Last 30 days
          </span>
        </div>
        <div className="h-px bg-border/40" />
        <div className="p-5">
          <MuscleBalanceRadar
            data={volumeData?.muscle_breakdown ?? []}
          />
        </div>
      </div>

      {/* Body Composition */}
      <div className="rounded-2xl border border-border/60 bg-card/30">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <Scale className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-bold">Body Composition</span>
        </div>
        <div className="h-px bg-border/40" />
        <div className="p-5">
          <BodyCompositionChart
            data={weightData ?? []}
            isImperial={isImperial}
          />
        </div>
      </div>

      {/* Nutrition Trends */}
      <NutritionTrendCharts />
    </div>
  );
}
