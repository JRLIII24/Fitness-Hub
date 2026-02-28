"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ChevronDown, TrendingUp, Star, Zap, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TemplateCard, TemplateCardSkeleton } from "./template-card";
import { TemplatePreviewDialog } from "./template-preview-dialog";
import { getMuscleColor, MUSCLE_FILTERS } from "./muscle-colors";
import type { PublicTemplate } from "@/types/pods";

// ── types ─────────────────────────────────────────────────────────────────────

type SortKey = "save_count" | "trending" | "newest" | "rating";
type TabKey = "community" | "mine";

const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: "trending", label: "Trending", icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { key: "save_count", label: "Most Saved", icon: <Star className="h-3.5 w-3.5" /> },
  { key: "newest", label: "New", icon: <Zap className="h-3.5 w-3.5" /> },
  { key: "rating", label: "Top Rated", icon: <Star className="h-3.5 w-3.5" fill="currentColor" /> },
];

// ── fetcher ───────────────────────────────────────────────────────────────────

async function fetchTemplates(params: {
  search?: string;
  muscle_groups?: string;
  sort: SortKey;
  page: number;
  tab: TabKey;
}): Promise<{ templates: PublicTemplate[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.search) sp.set("search", params.search);
  if (params.muscle_groups) sp.set("muscle_groups", params.muscle_groups);
  sp.set("sort", params.sort);
  sp.set("page", String(params.page));
  sp.set("page_size", "20");
  if (params.tab === "mine") sp.set("tab", "mine");

  const res = await fetch(`/api/templates/discover?${sp}`);
  if (!res.ok) throw new Error("Failed to load templates");
  return res.json();
}

// ── main component ────────────────────────────────────────────────────────────

export function MarketplaceContent() {
  const router = useRouter();

  const [templates, setTemplates] = useState<PublicTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);

  const [activeTab, setActiveTab] = useState<TabKey>("community");
  const [search, setSearch] = useState("");
  const [deferSearch, setDeferSearch] = useState("");
  const [filter, setFilter] = useState<string>("All");
  const [sort, setSort] = useState<SortKey>("trending");
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PublicTemplate | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [importedId, setImportedId] = useState<string | null>(null);

  // Fetch current user ID once for own-template detection
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? undefined);
    });
  }, []);

  // ── debounce search ─────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDeferSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // ── close sort dropdown on outside click ───────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSort(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Real-time sync: listen for template changes (edit/delete) ───────────────
  // When a template is edited or deleted, refresh the list to keep UI in sync.
  // This ensures changes made elsewhere in the app immediately reflect in the marketplace.
  useEffect(() => {
    const supabase = createClient();

    const subscription = supabase
      .channel('workout_templates_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workout_templates' },
        (payload) => {
          // On UPDATE or DELETE, refresh the marketplace list
          if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            setPage(1);
            setLoading(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // ── load templates ──────────────────────────────────────────────────────────
  const load = useCallback(async (pg: number, append = false) => {
    try {
      const muscleParam = filter !== "All" ? filter.toLowerCase() : undefined;
      const result = await fetchTemplates({
        search: deferSearch || undefined,
        muscle_groups: muscleParam,
        sort,
        page: pg,
        tab: activeTab,
      });

      setTemplates(prev => append ? [...prev, ...result.templates] : result.templates);
      setTotal(result.total);

      // Seed savedIds: reset on fresh loads, merge on append
      const freshSaved = new Set(result.templates.filter(t => t.is_saved).map(t => t.id));
      setSavedIds(prev => {
        if (!append) return freshSaved;
        const next = new Set(prev);
        freshSaved.forEach(id => next.add(id));
        return next;
      });
    } catch {
      toast.error("Failed to load marketplace");
    }
  }, [deferSearch, filter, sort, activeTab]);

  // reset + reload when filters/sort/tab change
  useEffect(() => {
    setPage(1);
    setLoading(true);
    load(1).finally(() => setLoading(false));
  }, [load]);

  // ── save toggle ─────────────────────────────────────────────────────────────
  const toggleSave = useCallback(async (templateId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const wasSaved = savedIds.has(templateId);

    // Optimistic update
    setSavedIds(prev => {
      const next = new Set(prev);
      wasSaved ? next.delete(templateId) : next.add(templateId);
      return next;
    });

    try {
      const method = wasSaved ? "DELETE" : "POST";
      const res = await fetch(`/api/templates/${templateId}/save`, { method });
      if (!res.ok) throw new Error();
    } catch {
      // Revert
      setSavedIds(prev => {
        const next = new Set(prev);
        wasSaved ? next.add(templateId) : next.delete(templateId);
        return next;
      });
      toast.error(wasSaved ? "Failed to unsave template" : "Failed to save template");
    }
  }, [savedIds]);

  // ── import ──────────────────────────────────────────────────────────────────
  const handleImport = useCallback(async (templateId: string) => {
    const res = await fetch(`/api/templates/${templateId}/import`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to import. Please try again.");
      throw new Error(data.error ?? "Import failed");
    }

    setImportedId(data.templateId ?? null);

    if (data.isNew) {
      toast.success("Workout added to your library!");
    } else {
      toast.info("You already have this workout — here it is.");
    }
  }, []);

  // ── load more ───────────────────────────────────────────────────────────────
  async function loadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    await load(nextPage, true);
    setPage(nextPage);
    setLoadingMore(false);
  }

  const hasMore = templates.length < total;

  const currentSort = SORT_OPTIONS.find(s => s.key === sort)!;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 md:px-6">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative mb-5 overflow-hidden rounded-3xl border border-border/70 bg-card/90 px-6 py-7 sm:px-8"
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/15 blur-[70px]" />
        <div className="pointer-events-none absolute -bottom-10 -left-10 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl" />

        <div className="relative">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1">
            <Dumbbell className="h-2.5 w-2.5 text-primary" />
            <span className="text-[10px] font-bold text-primary">Community</span>
          </div>
          <h1
            className="font-black leading-tight tracking-tight text-foreground"
            style={{ fontSize: "clamp(22px, 5vw, 34px)" }}
          >
            Template <span className="text-primary">Marketplace</span>
          </h1>
          <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            Battle-tested workouts built by the community. Browse, save, and import in one tap.
          </p>
        </div>
      </motion.section>

      {/* ── Controls ─────────────────────────────────────────────────────── */}
      <div className="mb-4 space-y-3">

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl border border-border/50 bg-card/40 p-1">
          {(["community", "mine"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); setPage(1); }}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-all duration-150",
                activeTab === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "community" ? "Community" : "My Templates"}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="flex h-11 items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 transition-colors focus-within:border-primary/50">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileTap={{ scale: 0.85 }}
                onClick={() => setSearch("")}
                className="text-muted-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Filter pills */}
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
          {MUSCLE_FILTERS.map(f => {
            const on = filter === f;
            const mgc = f !== "All" ? getMuscleColor(f) : null;
            return (
              <motion.button
                key={f}
                whileTap={{ scale: 0.93 }}
                onClick={() => setFilter(f)}
                className="shrink-0 rounded-full px-3.5 py-1.5 text-[11px] font-semibold transition-all duration-150"
                style={{
                  background: on
                    ? (mgc ? mgc.bgAlpha : "rgba(200,255,0,0.15)")
                    : "rgba(255,255,255,0.04)",
                  border: `1px solid ${on
                    ? (mgc ? mgc.borderAlpha : "rgba(200,255,0,0.4)")
                    : "rgba(255,255,255,0.08)"}`,
                  color: on
                    ? (mgc ? mgc.labelColor : "hsl(var(--primary))")
                    : "hsl(var(--muted-foreground))",
                  fontWeight: on ? 700 : 500,
                }}
              >
                {f}
              </motion.button>
            );
          })}
        </div>

        {/* Count + Sort row */}
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-muted-foreground">
            <span className="font-bold text-foreground">{loading ? "—" : total}</span> templates
          </span>

          <div ref={sortRef} className="relative">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowSort(v => !v)}
              className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-card/40 px-3 py-1.5 text-[11px] font-semibold text-foreground"
            >
              <span className="text-sky-400">{currentSort.icon}</span>
              {currentSort.label}
              <ChevronDown className={cn("h-3 w-3 transition-transform", showSort && "rotate-180")} />
            </motion.button>

            <AnimatePresence>
              {showSort && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[148px] overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-xl backdrop-blur-sm"
                >
                  {SORT_OPTIONS.map(s => (
                    <button
                      key={s.key}
                      onClick={() => { setSort(s.key); setShowSort(false); }}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-card/70",
                        sort === s.key
                          ? "font-bold text-primary"
                          : "font-medium text-foreground",
                      )}
                    >
                      <span className={cn(sort === s.key ? "text-primary" : "text-muted-foreground")}>
                        {s.icon}
                      </span>
                      {s.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <TemplateCardSkeleton key={i} />)}
        </div>
      ) : templates.length === 0 ? (
        /* Empty state */
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-border/60 bg-card/40">
            <Dumbbell className="h-7 w-7 text-muted-foreground/50" />
          </div>
          <h3 className="mb-1.5 text-[18px] font-black text-foreground">
            {activeTab === "mine" ? "No public templates yet" : "No templates found"}
          </h3>
          <p className="mb-4 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {activeTab === "mine"
              ? "Save a workout as a template and share it to the marketplace."
              : "Try adjusting your filters or search term."}
          </p>
          {activeTab === "community" && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => { setFilter("All"); setSearch(""); }}
              className="rounded-xl border border-primary/30 bg-primary/15 px-5 py-2.5 text-[13px] font-bold text-primary"
            >
              Clear filters
            </motion.button>
          )}
        </motion.div>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {templates.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
              >
                <TemplateCard
                  template={t}
                  isSaved={savedIds.has(t.id)}
                  onSave={e => toggleSave(t.id, e)}
                  onPreview={() => setPreview(t)}
                  currentUserId={currentUserId}
                />
              </motion.div>
            ))}
          </motion.div>

          {/* Load more */}
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-xl border border-border/60 bg-card/40 px-6 py-2.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </motion.button>
            </div>
          )}
        </>
      )}

      {/* ── Preview dialog ───────────────────────────────────────────────── */}
      <TemplatePreviewDialog
        template={preview}
        isSaved={preview ? savedIds.has(preview.id) : false}
        onSave={() => preview && toggleSave(preview.id)}
        onImport={() => preview ? handleImport(preview.id) : Promise.resolve()}
        onClose={() => { setPreview(null); setImportedId(null); }}
        currentUserId={currentUserId}
        importedTemplateId={importedId}
        onStartWorkout={(id) => { setPreview(null); setImportedId(null); router.push(`/workout?from_launcher=1&template_id=${id}`); }}
        onViewLibrary={() => { setPreview(null); setImportedId(null); router.push("/templates"); }}
      />
    </div>
  );
}
