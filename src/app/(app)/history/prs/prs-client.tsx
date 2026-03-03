"use client";

import { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { Medal, Trophy, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { kgToLbs } from "@/lib/units";
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

const MUSCLE_DOT_COLORS: Record<string, string> = {
  chest: "bg-rose-400",
  back: "bg-sky-400",
  shoulders: "bg-violet-400",
  biceps: "bg-amber-400",
  triceps: "bg-orange-400",
  legs: "bg-emerald-400",
  glutes: "bg-pink-400",
  abs: "bg-cyan-400",
  cardio: "bg-indigo-400",
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
      ? `${Math.round(kgToLbs(kg))} lbs`
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
        const aW = isImperial ? kgToLbs(a.pr_kg) : a.pr_kg;
        const bW = isImperial ? kgToLbs(b.pr_kg) : b.pr_kg;
        return bW - aW;
      })
      .slice(0, 3);
  }, [prs, isImperial]);

  return (
    <div className="space-y-5">
      {/* Top 3 Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {topPRs.map((pr, idx) => (
          <motion.div
            key={pr.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.07 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-2xl border border-border/60 bg-card/30 p-4 text-center"
          >
            <div className="mb-1.5 flex justify-center">
              <Medal className={cn("h-7 w-7", idx === 0 ? "text-yellow-400" : idx === 1 ? "text-slate-400" : "text-amber-600")} />
            </div>
            <p className="truncate min-w-0 text-[12px] sm:text-[13px] font-semibold">{pr.name}</p>
            <p className="tabular-nums text-[22px] sm:text-[26px] font-black leading-none text-foreground">
              {displayWeight(pr.pr_kg)}
            </p>
            {pr.reps && (
              <p className="mt-1 text-[11px] text-muted-foreground">x {pr.reps} reps</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* Search + Muscle Filter */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search exercise…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10 rounded-xl text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setActiveGroup("all")}
            className={cn(
              "h-8 rounded-full px-3.5 text-[11px] font-semibold transition-colors",
              activeGroup === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
            )}
          >
            All
          </button>
          {muscleGroups.map((mg) => (
            <button
              key={mg}
              onClick={() => setActiveGroup(mg === activeGroup ? "all" : mg)}
              className={cn(
                "h-8 rounded-full px-3.5 text-[11px] font-semibold capitalize transition-colors",
                activeGroup === mg
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
              )}
            >
              {(MUSCLE_GROUP_LABELS as Record<string, string>)[mg] ?? mg}
            </button>
          ))}
        </div>
      </div>

      {/* PR Groups */}
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-[13px] text-muted-foreground">No results</p>
      ) : (
        <div className="space-y-3">
          {[...grouped.entries()].map(([group, groupPRs]) => (
            <div key={group} className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
              <div className="border-b border-border/40 px-4 py-3 flex items-center gap-2">
                <span className={cn("h-2 w-2 rounded-full shrink-0", MUSCLE_DOT_COLORS[group.toLowerCase()] ?? "bg-muted-foreground")} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground capitalize">
                  {(MUSCLE_GROUP_LABELS as Record<string, string>)[group] ?? group}
                </span>
                <span className="text-[10px] text-muted-foreground/60">
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
                    className="flex items-center justify-between gap-3 min-w-0 px-4 py-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold min-w-0 truncate">{pr.name}</p>
                        {pr.achieved_at && (
                          <p className="text-[11px] text-muted-foreground shrink-0">
                            {format(parseISO(pr.achieved_at), "MMM d, yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="tabular-nums text-[15px] font-black shrink-0">
                        {displayWeight(pr.pr_kg)}
                      </p>
                      {pr.reps && (
                        <p className="text-[11px] text-muted-foreground">x {pr.reps} reps</p>
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
