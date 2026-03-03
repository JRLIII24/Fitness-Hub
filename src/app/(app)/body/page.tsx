"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { format, parseISO, subDays } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Scale,
  Plus,
  Pencil,
  Trash2,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { useUnitPreferenceStore } from "@/stores/unit-preference-store";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WeightLog = {
  id: string;
  logged_date: string;
  weight_kg: number;
  body_fat_pct: number | null;
  note: string | null;
};

type RangeOption = "30d" | "90d" | "1y" | "all";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function kgToDisplay(kg: number, isImperial: boolean) {
  return isImperial ? Math.round(kg * 2.20462 * 10) / 10 : Math.round(kg * 10) / 10;
}

function displayToKg(val: number, isImperial: boolean) {
  return isImperial ? val / 2.20462 : val;
}

const WeightChart = dynamic(() => import("@/components/charts/weight-chart"), {
  loading: () => <Skeleton className="h-[180px] w-full rounded-xl" />,
  ssr: false,
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BodyMetricsPage() {
  const { preference, unitLabel } = useUnitPreferenceStore();
  const isImperial = preference === "imperial";

  const [logs, setLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>("90d");
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formWeight, setFormWeight] = useState("");
  const [formBf, setFormBf] = useState("");
  const [formNote, setFormNote] = useState("");

  const resetForm = useCallback(() => {
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormWeight("");
    setFormBf("");
    setFormNote("");
    setFormError(null);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/body/weight?limit=365");
    if (res.ok) {
      const data: WeightLog[] = await res.json();
      setLogs(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  // Filter by range
  const filteredLogs = (() => {
    if (range === "all") return [...logs];
    const days = range === "30d" ? 30 : range === "90d" ? 90 : 365;
    const cutoff = subDays(new Date(), days).toISOString().slice(0, 10);
    return logs.filter((l) => l.logged_date >= cutoff);
  })();

  // Chart data (chronological)
  const chartData = [...filteredLogs]
    .reverse()
    .map((l) => ({
      date: format(parseISO(l.logged_date), "MMM d"),
      weight_kg: l.weight_kg,
    }));

  const timelineLogs = [...filteredLogs].slice(0, 12).reverse();
  const timelineWeights = timelineLogs.map((l) => kgToDisplay(l.weight_kg, isImperial));
  const timelineMin = timelineWeights.length ? Math.min(...timelineWeights) : 0;
  const timelineMax = timelineWeights.length ? Math.max(...timelineWeights) : 0;
  const timelineSpread = timelineMax - timelineMin;
  const timelineStart = timelineLogs[0];
  const timelineCurrent = timelineLogs[timelineLogs.length - 1];
  const timelineChange =
    timelineStart && timelineCurrent
      ? kgToDisplay(timelineCurrent.weight_kg, isImperial) -
        kgToDisplay(timelineStart.weight_kg, isImperial)
      : null;

  // Stats
  const latest = logs[0];
  const oldest = filteredLogs[filteredLogs.length - 1];
  const delta =
    latest && oldest && latest.id !== oldest.id
      ? kgToDisplay(latest.weight_kg, isImperial) - kgToDisplay(oldest.weight_kg, isImperial)
      : null;

  const handleSave = async () => {
    setFormError(null);
    const wVal = parseFloat(formWeight);
    if (!formWeight || Number.isNaN(wVal) || wVal <= 0) {
      setFormError("Enter a valid weight greater than 0.");
      return;
    }

    const bodyFat = formBf.trim() ? parseFloat(formBf) : null;
    if (
      bodyFat != null &&
      (Number.isNaN(bodyFat) || bodyFat < 0 || bodyFat > 100)
    ) {
      setFormError("Body fat must be between 0 and 100.");
      return;
    }

    setSubmitting(true);
    const weight_kg = displayToKg(wVal, isImperial);
    const body_fat_pct = bodyFat;
    const payload = {
      logged_date: formDate,
      weight_kg,
      body_fat_pct,
      note: formNote.trim() || null,
    };

    const res = await fetch("/api/body/weight", {
      method: editingLogId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editingLogId ? { id: editingLogId, ...payload } : payload),
    });

    if (res.ok) {
      resetForm();
      setEditingLogId(null);
      setShowForm(false);
      await fetchLogs();
    } else {
      const err = (await res.json().catch(() => null)) as { error?: string } | null;
      setFormError(err?.error ?? "Failed to save body metric entry.");
    }
    setSubmitting(false);
  };

  const handleEdit = (log: WeightLog) => {
    setEditingLogId(log.id);
    setFormDate(log.logged_date);
    setFormWeight(String(kgToDisplay(log.weight_kg, isImperial)));
    setFormBf(log.body_fat_pct != null ? String(log.body_fat_pct) : "");
    setFormNote(log.note ?? "");
    setFormError(null);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setEditingLogId(null);
    resetForm();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/body/weight?id=${id}`, { method: "DELETE" });
    if (editingLogId === id) {
      handleCancelEdit();
      setShowForm(false);
    }
    await fetchLogs();
  };

  const toggleForm = () => {
    if (showForm) {
      setShowForm(false);
      setEditingLogId(null);
      setFormError(null);
      return;
    }
    setEditingLogId(null);
    resetForm();
    setShowForm(true);
  };

  const TrendIcon =
    delta === null ? Minus : delta < 0 ? TrendingDown : TrendingUp;
  const trendColor =
    delta === null
      ? "text-muted-foreground"
      : delta < 0
      ? "text-emerald-400"
      : "text-rose-400";

  const RANGES: { label: string; value: RangeOption }[] = [
    { label: "30D", value: "30d" },
    { label: "90D", value: "90d" },
    { label: "1Y", value: "1y" },
    { label: "All", value: "all" },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-6">
      <PageHeader title="Body Metrics" />

      {/* ── Hero Stats ─────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border/70 bg-card/90 p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        ) : latest ? (
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Current Weight
              </p>
              <p className="text-[40px] font-black leading-none tabular-nums">
                {kgToDisplay(latest.weight_kg, isImperial)}
                <span className="ml-1.5 text-[18px] font-bold text-muted-foreground">
                  {unitLabel}
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {format(parseISO(latest.logged_date), "MMMM d, yyyy")}
              </p>
            </div>
            {delta !== null && (
              <div className={cn("flex items-center gap-1 text-sm font-semibold", trendColor)}>
                <TrendIcon className="h-4 w-4" />
                <span>
                  {delta > 0 ? "+" : ""}
                  {delta.toFixed(1)} {unitLabel}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No weight logged yet. Add your first entry below.
          </div>
        )}
      </div>

      {/* ── Chart ──────────────────────────────────────────────────── */}
      {!loading && logs.length > 0 && (
        <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[13px] font-bold text-foreground">Weight History</p>
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors",
                    range === r.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          {chartData.length > 0 ? (
            <>
              <WeightChart chartData={chartData} isImperial={isImperial} />
              {chartData.length === 1 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Add one more entry to unlock a full trend line.
                </p>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
              <p className="text-[12px] text-muted-foreground">
                No entries in this range.
              </p>
              <Button
                onClick={() => setRange("all")}
                variant="outline"
                size="xs"
                className="mt-2"
              >
                Show All
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Timeline Ribbon ────────────────────────────────────────── */}
      {!loading && timelineLogs.length > 1 && (
        <div className="rounded-2xl border border-border/60 bg-card/30 p-4">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[13px] font-bold text-foreground">Body Trend Ribbon</p>
              <p className="text-[10px] text-muted-foreground">
                Last {timelineLogs.length} entries in this view
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Range {timelineMin.toFixed(1)}-{timelineMax.toFixed(1)} {unitLabel}
            </p>
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Start</p>
              <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                {timelineStart ? `${kgToDisplay(timelineStart.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Current</p>
              <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-foreground">
                {timelineCurrent ? `${kgToDisplay(timelineCurrent.weight_kg, isImperial).toFixed(1)} ${unitLabel}` : "--"}
              </p>
            </div>
            <div className="rounded-xl border border-border/50 bg-muted/20 px-2.5 py-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Change</p>
              <p
                className={cn(
                  "mt-0.5 text-[12px] font-semibold tabular-nums",
                  timelineChange == null
                    ? "text-muted-foreground"
                    : timelineChange < 0
                      ? "text-emerald-400"
                      : timelineChange > 0
                        ? "text-rose-400"
                        : "text-muted-foreground"
                )}
              >
                {timelineChange == null
                  ? "--"
                  : `${timelineChange > 0 ? "+" : ""}${timelineChange.toFixed(1)} ${unitLabel}`}
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            {timelineLogs.map((log, idx) => {
              const displayWeight = kgToDisplay(log.weight_kg, isImperial);
              const prevWeight =
                idx > 0
                  ? kgToDisplay(timelineLogs[idx - 1].weight_kg, isImperial)
                  : null;
              const stepDelta =
                prevWeight != null ? displayWeight - prevWeight : null;
              const rawPct =
                timelineSpread <= 0
                  ? 100
                  : ((displayWeight - timelineMin) / timelineSpread) * 100;
              const pct = Math.max(8, Math.min(100, rawPct));
              const barColor =
                stepDelta == null
                  ? "bg-primary"
                  : stepDelta < 0
                    ? "bg-emerald-400"
                    : stepDelta > 0
                      ? "bg-rose-400"
                      : "bg-primary";

              return (
                <div
                  key={log.id}
                  className="grid grid-cols-[52px_1fr_auto] items-center gap-2.5"
                >
                  <p className="text-[10px] text-muted-foreground">
                    {format(parseISO(log.logged_date), "MMM d")}
                  </p>
                  <div className="relative h-2.5 overflow-hidden rounded-full bg-muted/40">
                    <motion.div
                      className={cn("h-full rounded-full", barColor)}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.35 }}
                    />
                    <div className="absolute inset-y-0 right-0 w-px bg-border/60" />
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold tabular-nums text-foreground">
                      {displayWeight.toFixed(1)}
                    </p>
                    {stepDelta != null && (
                      <p
                        className={cn(
                          "text-[9px] tabular-nums",
                          stepDelta < 0
                            ? "text-emerald-400"
                            : stepDelta > 0
                              ? "text-rose-400"
                              : "text-muted-foreground"
                        )}
                      >
                        {stepDelta > 0 ? "+" : ""}
                        {stepDelta.toFixed(1)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Log Form ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden">
        <button
          onClick={toggleForm}
          className="flex w-full items-center justify-between p-4"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              {editingLogId ? (
                <Pencil className="h-4 w-4 text-primary" />
              ) : (
                <Plus className="h-4 w-4 text-primary" />
              )}
            </div>
            <span className="text-[13px] font-bold">
              {editingLogId ? "Edit Entry" : "Log Weight"}
            </span>
          </div>
          <motion.div animate={{ rotate: showForm ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </button>

        <AnimatePresence initial={false}>
          {showForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-border/40 px-4 pb-4 pt-3">
                {editingLogId && (
                  <p className="text-[11px] font-medium text-primary">
                    Editing an existing body metric entry
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Date</Label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Weight ({unitLabel})</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder={unitLabel === "kg" ? "75.0" : "165.0"}
                      value={formWeight}
                      onChange={(e) => setFormWeight(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Body Fat % (optional)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      placeholder="18.5"
                      value={formBf}
                      onChange={(e) => setFormBf(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Note (optional)</Label>
                    <Input
                      placeholder="Morning, after workout…"
                      value={formNote}
                      onChange={(e) => setFormNote(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
                {formError && (
                  <p className="text-[11px] text-destructive">{formError}</p>
                )}
                <div className="flex gap-2">
                  {editingLogId && (
                    <Button
                      onClick={handleCancelEdit}
                      disabled={submitting}
                      className="flex-1"
                      variant="outline"
                      size="sm"
                    >
                      Cancel
                    </Button>
                  )}
                  <Button
                    onClick={handleSave}
                    disabled={submitting || !formWeight}
                    className="flex-1"
                    size="sm"
                  >
                    {submitting
                      ? editingLogId
                        ? "Updating..."
                        : "Saving..."
                      : editingLogId
                      ? "Update Entry"
                      : "Save Entry"}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Log List ───────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-border/60 bg-card/30">
        <div className="border-b border-border/40 px-4 py-3">
          <p className="text-[13px] font-bold">
            <Scale className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
            Recent Entries
          </p>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-xl" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No entries yet. Log your first weight above.
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {logs.slice(0, 30).map((log) => (
              <div
                key={log.id}
                className={cn(
                  "flex items-center justify-between px-4 py-2.5",
                  editingLogId === log.id && "bg-primary/5"
                )}
              >
                <div>
                  <p className="text-sm font-semibold tabular-nums">
                    {kgToDisplay(log.weight_kg, isImperial)} {unitLabel}
                    {log.body_fat_pct != null && (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        {log.body_fat_pct}% BF
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(parseISO(log.logged_date), "EEE, MMM d yyyy")}
                    {log.note ? ` · ${log.note}` : ""}
                  </p>
                </div>
                <div className="ml-2 flex items-center gap-1">
                  <Button
                    onClick={() => handleEdit(log)}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Edit entry"
                    className="text-muted-foreground/70 hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    onClick={() => handleDelete(log.id)}
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete entry"
                    className="text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
