"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";
import { MUSCLE_GROUP_LABELS } from "@/lib/constants";

type PR = {
  id: string;
  name: string;
  muscle_group: string;
  pr_kg: number;
  reps: number | null;
  achieved_at: string;
};

const MUSCLE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  biceps: "bg-amber-500/20 text-amber-400",
  triceps: "bg-orange-500/20 text-orange-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  glutes: "bg-pink-500/20 text-pink-400",
  abs: "bg-cyan-500/20 text-cyan-400",
  cardio: "bg-indigo-500/20 text-indigo-400",
};

function getMuscleColor(group: string) {
  return MUSCLE_COLORS[group.toLowerCase()] ?? "bg-muted/50 text-muted-foreground";
}

export function PRsClient({
  prs,
  muscleGroups,
}: {
  prs: PR[];
  muscleGroups: string[];
}) {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const displayWeight = (kg: number) =>
    isImperial
      ? `${Math.round(kg * 2.20462)} lbs`
      : `${Math.round(kg * 10) / 10} kg`;

  const filtered = useMemo(() => {
    return prs.filter((pr) => {
      const matchGroup = activeGroup === "all" || pr.muscle_group === activeGroup;
      const matchQuery =
        !query || pr.name.toLowerCase().includes(query.toLowerCase());
      return matchGroup && matchQuery;
    });
  }, [prs, activeGroup, query]);

  // Group filtered PRs by muscle group
  const grouped = useMemo(() => {
    const map = new Map<string, PR[]>();
    for (const pr of filtered) {
      if (!map.has(pr.muscle_group)) map.set(pr.muscle_group, []);
      map.get(pr.muscle_group)!.push(pr);
    }
    return map;
  }, [filtered]);

  const topPRs = useMemo(() => {
    return [...prs]
      .sort((a, b) => {
        const aW = isImperial ? a.pr_kg * 2.20462 : a.pr_kg;
        const bW = isImperial ? b.pr_kg * 2.20462 : b.pr_kg;
        return bW - aW;
      })
      .slice(0, 3);
  }, [prs, isImperial]);

  return (
    <div className="space-y-4">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-2">
        {topPRs.map((pr, idx) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            className="rounded-2xl border border-border/60 bg-card/30 p-3 text-center"
          >
            <div className="mb-1 text-lg">
              {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
            </div>
            <p className="truncate text-[11px] font-semibold">{pr.name}</p>
            <p className="truncate text-[15px] font-black tabular-nums leading-tight sm:text-[18px]">
              {displayWeight(pr.pr_kg)}
            </p>
            {pr.reps && (
              <p className="text-[10px] text-muted-foreground">× {pr.reps} reps</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Search + Muscle Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercise…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGroup("all")}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-semibold transition-colors",
              activeGroup === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:text-foreground"
            )}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setActiveGroup(mg === activeGroup ? "all" : mg)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold capitalize transition-colors",
                activeGroup === mg
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/50 text-muted-foreground hover:text-foreground"
              )}
            >
              {(MUSCLE_GROUP_LABELS as Record<string, string>)[mg] ?? mg}
            </button>
          ))}
        </div>
      </div>

      {/* PR Groups */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No results</p>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([group, groupPRs]) => (
            <div key={group} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
              <div className="border-b border-border/40 px-4 py-2.5 flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide capitalize",
                    getMuscleColor(group)
                  )}
                >
                  {(MUSCLE_GROUP_LABELS as Record<string, string>)[group] ?? group}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {groupPRs.length} exercise{groupPRs.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="divide-y divide-border/30">
                {groupPRs.map((pr, idx) => (
                  <motion.div
                    key={pr.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    className="flex items-center justify-between px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{pr.name}</p>
                        {pr.achieved_at && (
                          <p className="text-[10px] text-muted-foreground">
                            {format(parseISO(pr.achieved_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="text-base font-black tabular-nums">
                        {displayWeight(pr.pr_kg)}
                      </p>
                      {pr.reps && (
                        <p className="text-[10px] text-muted-foreground">× {pr.reps} reps</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
