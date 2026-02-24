"use client";

import type { RunSplit } from "@/types/run";
import { ZONE_SHORT_LABELS, ZONE_COLORS } from "@/types/run";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import type { RunIntensityZone } from "@/types/run";

interface SplitsTableProps {
  splits: RunSplit[];
}

export function SplitsTable({ splits }: SplitsTableProps) {
  const formatPace = useUnitPreferenceStore((s) => s.formatPace);
  const distanceLabel = useUnitPreferenceStore((s) => s.distanceLabel);

  if (splits.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No splits recorded.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 bg-muted/30">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">
              Split
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Pace
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">
              Zone
            </th>
          </tr>
        </thead>
        <tbody>
          {splits.map((split) => (
            <tr
              key={split.id || split.split_number}
              className="border-b border-border/20 last:border-0"
            >
              <td className="px-3 py-2 font-medium">
                {distanceLabel === "mi" ? "Mile" : "KM"} {split.split_number}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatPace(split.pace_sec_per_km)}
              </td>
              <td className="px-3 py-2 text-right">
                {split.zone ? (
                  <span
                    className="inline-block rounded px-1.5 py-0.5 text-xs font-semibold"
                    style={{
                      color: ZONE_COLORS[split.zone as RunIntensityZone],
                      backgroundColor: `${ZONE_COLORS[split.zone as RunIntensityZone]}20`,
                    }}
                  >
                    {ZONE_SHORT_LABELS[split.zone as RunIntensityZone]}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
