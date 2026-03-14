"use client";

import { TrendingUp, TrendingDown, Minus, ShieldAlert } from "lucide-react";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { weightToDisplay } from "@/lib/units";
import type { AutoregulationPrescription } from "@/lib/coach/types";

interface PrescriptionCardProps {
  prescription: AutoregulationPrescription & {
    reasoning_flag?: "cns_bypass" | "local_fatigue" | "peak" | "standard";
    machine_substitute?: string;
  };
}

const FACTOR_CONFIG = {
  push: {
    label: "Push",
    color: "hsl(142, 71%, 45%)",
    bgAlpha: "rgba(34, 197, 94, 0.12)",
    borderAlpha: "rgba(34, 197, 94, 0.25)",
    Icon: TrendingUp,
  },
  maintain: {
    label: "Maintain",
    color: "hsl(38, 92%, 50%)",
    bgAlpha: "rgba(245, 158, 11, 0.12)",
    borderAlpha: "rgba(245, 158, 11, 0.25)",
    Icon: Minus,
  },
  deload: {
    label: "Deload",
    color: "hsl(0, 84%, 60%)",
    bgAlpha: "rgba(239, 68, 68, 0.12)",
    borderAlpha: "rgba(239, 68, 68, 0.25)",
    Icon: TrendingDown,
  },
} as const;

export function PrescriptionCard({ prescription }: PrescriptionCardProps) {
  const { preference } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const factor = FACTOR_CONFIG[prescription.readiness_factor];
  const FactorIcon = factor.Icon;

  const displayWeight = weightToDisplay(
    prescription.target_weight_kg,
    isImperial,
    1
  );
  const unitLabel = isImperial ? "lbs" : "kg";

  const overloadSign = prescription.progressive_overload_pct >= 0 ? "+" : "";
  const overloadText = `${overloadSign}${prescription.progressive_overload_pct.toFixed(1)}%`;

  const isCnsBypass = prescription.reasoning_flag === "cns_bypass";

  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-3">
      {/* CNS Protection alert */}
      {isCnsBypass && (
        <div
          className="mb-2 flex items-center gap-2 rounded-lg px-2.5 py-1.5"
          style={{
            background: "rgba(168, 85, 247, 0.12)",
            border: "1px solid rgba(168, 85, 247, 0.25)",
          }}
        >
          <ShieldAlert
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: "rgba(168, 85, 247, 1)" }}
          />
          <span
            className="text-[11px] font-semibold leading-tight"
            style={{ color: "rgba(168, 85, 247, 1)" }}
          >
            CNS Protection — Machine variation recommended
            {prescription.machine_substitute && (
              <span className="font-normal">
                {" "}
                &middot; Use {prescription.machine_substitute}
              </span>
            )}
          </span>
        </div>
      )}

      {/* Header: exercise name + readiness badge */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h4 className="text-[13px] font-bold text-foreground leading-tight">
          {prescription.exercise_name}
        </h4>
        <span
          className="flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            background: factor.bgAlpha,
            color: factor.color,
            border: `1px solid ${factor.borderAlpha}`,
          }}
        >
          <FactorIcon className="h-3 w-3" />
          {factor.label}
        </span>
      </div>

      {/* Target row */}
      <div className="mb-2 grid grid-cols-3 gap-2">
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Weight
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {displayWeight}
            <span className="ml-0.5 text-[10px] font-semibold text-muted-foreground">
              {unitLabel}
            </span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Reps
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {prescription.target_reps}
          </p>
        </div>
        <div className="text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Sets
          </p>
          <p className="tabular-nums text-[17px] font-black leading-none text-foreground">
            {prescription.target_sets}
          </p>
        </div>
      </div>

      {/* Progressive overload */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Overload
        </span>
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums"
          style={{ background: factor.bgAlpha, color: factor.color }}
        >
          {overloadText}
        </span>
      </div>

      {/* Rationale */}
      {prescription.rationale && (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {prescription.rationale}
        </p>
      )}
    </div>
  );
}
