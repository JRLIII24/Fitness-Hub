"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Brain, Dumbbell, Search, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { ProgramCard } from "@/components/programs/program-card";
import { MarketplaceProgramCard, ProgramCardSkeleton } from "@/components/programs/marketplace-program-card";
import { ProgramPreviewDialog } from "@/components/programs/program-preview-dialog";
import type { PublicProgram } from "@/components/programs/program-types";
import { TrainSubNav } from "@/components/layout/train-sub-nav";

interface Program {
  id: string;
  name: string;
  description: string | null;
  goal: string;
  weeks: number;
  days_per_week: number;
  status: string;
  current_week: number | null;
  current_day: number | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ProgramsClientProps {
  initialPrograms: Program[];
}

type Tab = "mine" | "community";

const GOAL_FILTERS = [
  { value: "", label: "All" },
  { value: "strength", label: "Strength" },
  { value: "hypertrophy", label: "Hypertrophy" },
  { value: "general", label: "General" },
  { value: "weight_loss", label: "Weight Loss" },
] as const;

const SORT_OPTIONS = [
  { value: "popular", label: "Popular" },
  { value: "newest", label: "Newest" },
] as const;

export function ProgramsClient({ initialPrograms }: ProgramsClientProps) {
  const [tab, setTab] = useState<Tab>("mine");

  return (
    <div className="mx-auto max-w-lg space-y-4 px-4 pb-24 pt-4">
      <TrainSubNav />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[18px] font-black text-foreground">Programs</h1>
          <p className="text-[11px] text-muted-foreground">AI-generated periodized plans</p>
        </div>
        <Link href="/programs/new">
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-[11px] font-bold text-primary"
          >
            <Plus className="size-3.5" />
            New
          </motion.button>
        </Link>
      </div>

      {/* Tab toggle */}
      <div className="flex rounded-xl border border-border/50 glass-inner p-1">
        {(["mine", "community"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-1 rounded-lg py-2 text-[12px] font-bold transition-colors",
              tab === t
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "mine" ? "My Programs" : "Community"}
          </button>
        ))}
      </div>

      {tab === "mine" ? (
        <MyProgramsTab programs={initialPrograms} />
      ) : (
        <CommunityTab />
      )}
    </div>
  );
}

// ── My Programs Tab ────────────────────────────────────────────────────────────

function MyProgramsTab({ programs }: { programs: Program[] }) {
  const activeProgram = programs.find((p) => p.status === "active");
  const otherPrograms = programs.filter((p) => p.id !== activeProgram?.id);

  return (
    <div className="space-y-6">
      {activeProgram && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Active Program
          </p>
          <ProgramCard
            id={activeProgram.id}
            name={activeProgram.name}
            description={activeProgram.description}
            goal={activeProgram.goal}
            weeks={activeProgram.weeks}
            daysPerWeek={activeProgram.days_per_week}
            status={activeProgram.status}
            currentWeek={activeProgram.current_week ?? undefined}
            currentDay={activeProgram.current_day ?? undefined}
            startedAt={activeProgram.started_at}
            createdAt={activeProgram.created_at}
          />
        </div>
      )}

      {otherPrograms.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            {activeProgram ? "Other Programs" : "Your Programs"}
          </p>
          <div className="space-y-3">
            {otherPrograms.map((p) => (
              <ProgramCard
                key={p.id}
                id={p.id}
                name={p.name}
                description={p.description}
                goal={p.goal}
                weeks={p.weeks}
                daysPerWeek={p.days_per_week}
                status={p.status}
                currentWeek={p.current_week ?? undefined}
                currentDay={p.current_day ?? undefined}
                startedAt={p.started_at}
                createdAt={p.created_at}
              />
            ))}
          </div>
        </div>
      )}

      {programs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 rounded-2xl border border-border/60 bg-card/30 px-6 py-12 text-center"
        >
          <div className="flex items-center gap-2">
            <Brain className="size-6 text-primary/50" />
            <Dumbbell className="size-6 text-primary/50" />
          </div>
          <div>
            <p className="text-[14px] font-bold text-foreground">No programs yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Create an AI-generated training program or browse community programs.
            </p>
          </div>
          <Link href="/programs/new">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="rounded-xl bg-primary px-5 py-2.5 text-[12px] font-bold text-primary-foreground"
            >
              Build a Program
            </motion.button>
          </Link>
        </motion.div>
      )}
    </div>
  );
}

// ── Community Tab ──────────────────────────────────────────────────────────────

function CommunityTab() {
  const router = useRouter();
  const [programs, setPrograms] = useState<PublicProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [goalFilter, setGoalFilter] = useState("");
  const [sort, setSort] = useState("popular");
  const [previewProgram, setPreviewProgram] = useState<PublicProgram | null>(null);
  const limit = 12;

  const fetchPrograms = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit), sort });
      if (search.trim()) params.set("q", search.trim());
      if (goalFilter) params.set("goal", goalFilter);

      const res = await fetch(`/api/programs/discover?${params}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPrograms(data.programs ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setPrograms([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, goalFilter, sort, limit]);

  useEffect(() => {
    void fetchPrograms();
  }, [fetchPrograms]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, goalFilter, sort]);

  async function handleImport() {
    if (!previewProgram) return;
    const res = await fetch(`/api/programs/${previewProgram.id}/import`, { method: "POST" });
    if (!res.ok) throw new Error("Import failed");
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-border/50 glass-inner py-2.5 pl-9 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Goal filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {GOAL_FILTERS.map((g) => (
          <button
            key={g.value}
            onClick={() => setGoalFilter(g.value)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold transition-colors",
              goalFilter === g.value
                ? "bg-primary/15 text-primary border border-primary/25"
                : "bg-muted/20 text-muted-foreground border border-border/30",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-1.5">
        {SORT_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSort(s.value)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[10px] font-bold transition-colors",
              sort === s.value
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground self-center">
          {total} program{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <ProgramCardSkeleton key={i} />
          ))}
        </div>
      ) : programs.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {programs.map((p) => (
            <MarketplaceProgramCard
              key={p.id}
              program={p}
              onPreview={() => setPreviewProgram(p)}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-card/30 px-6 py-10 text-center"
        >
          <Brain className="size-6 text-primary/50" />
          <div>
            <p className="text-[13px] font-bold text-foreground">No community programs yet</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Be the first to share! Create a program and it will appear here for everyone.
            </p>
          </div>
          <Link href="/programs/new">
            <motion.button
              whileTap={{ scale: 0.95 }}
              className="rounded-xl bg-primary px-4 py-2 text-[11px] font-bold text-primary-foreground"
            >
              Build a Program
            </motion.button>
          </Link>
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            Prev
          </button>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg px-3 py-1.5 text-[11px] font-bold text-muted-foreground disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}

      {/* Preview dialog */}
      <ProgramPreviewDialog
        program={previewProgram}
        onImport={handleImport}
        onClose={() => setPreviewProgram(null)}
        onViewPrograms={() => {
          setPreviewProgram(null);
          router.refresh();
        }}
      />
    </div>
  );
}
