"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Globe,
  Lock,
  Star,
  Clock,
  Dumbbell,
  Trash2,
  ChevronRight,
  BookmarkCheck,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { MyTemplate } from "./page";

const MUSCLE_BADGE_COLORS: Record<string, string> = {
  chest: "bg-rose-500/20 text-rose-400",
  back: "bg-sky-500/20 text-sky-400",
  legs: "bg-emerald-500/20 text-emerald-400",
  shoulders: "bg-violet-500/20 text-violet-400",
  arms: "bg-amber-500/20 text-amber-400",
  core: "bg-cyan-500/20 text-cyan-400",
  full_body: "bg-primary/20 text-primary",
};

export function TemplatesManagerClient({
  templates: initial,
  muscleGroupLabels,
}: {
  templates: MyTemplate[];
  muscleGroupLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initial);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const supabase = createClient();

  async function togglePublic(id: string, current: boolean) {
    setToggling(id);
    const { error } = await supabase
      .from("workout_templates")
      .update({ is_public: !current })
      .eq("id", id);
    if (error) {
      toast.error("Failed to update template visibility");
    } else {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, is_public: !current } : t))
      );
      toast.success(!current ? "Template published to Marketplace" : "Template set to private");
    }
    setToggling(null);
  }

  async function deleteTemplate(id: string) {
    const confirmed = window.confirm("Delete this template? This cannot be undone.");
    if (!confirmed) return;
    setDeleting(id);
    const { error } = await supabase
      .from("workout_templates")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Failed to delete template");
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template deleted");
    }
    setDeleting(null);
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground">
        {templates.length} template{templates.length !== 1 ? "s" : ""}
      </p>

      <AnimatePresence initial={false}>
        {templates.map((t, i) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ delay: i * 0.03 }}
            className="rounded-2xl border border-border/60 bg-card/30 overflow-hidden"
          >
            <div className="flex items-start gap-3 p-4">
              {/* Color swatch */}
              <div
                className="mt-0.5 h-10 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: t.color ?? "hsl(var(--primary))" }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold truncate">{t.name}</p>
                  {t.is_public && (
                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
                      <Globe className="h-2.5 w-2.5" />
                      Public
                    </span>
                  )}
                </div>

                {t.description && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                    {t.description}
                  </p>
                )}

                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {t.primary_muscle_group && (
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                        MUSCLE_BADGE_COLORS[t.primary_muscle_group] ?? "bg-muted/50 text-muted-foreground"
                      )}
                    >
                      {muscleGroupLabels[t.primary_muscle_group] ?? t.primary_muscle_group}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Dumbbell className="h-2.5 w-2.5" />
                    {t.exercise_count} exercises
                  </span>
                  {t.estimated_duration_min && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" />
                      {t.estimated_duration_min}m
                    </span>
                  )}
                  {t.is_public && t.save_count > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <BookmarkCheck className="h-2.5 w-2.5" />
                      {t.save_count} saves
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 border-t border-border/40 px-3 py-2">
              <Link
                href={`/workout?template_id=${t.id}`}
                className="flex-1 rounded-lg px-3 py-1.5 text-center text-[11px] font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                Start Workout
              </Link>

              <button
                onClick={() => void togglePublic(t.id, t.is_public)}
                disabled={toggling === t.id}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground disabled:opacity-50"
                title={t.is_public ? "Set to private" : "Publish to Marketplace"}
              >
                {t.is_public ? (
                  <Lock className="h-3.5 w-3.5" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
              </button>

              <button
                onClick={() => void deleteTemplate(t.id)}
                disabled={deleting === t.id}
                className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-destructive/60 transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
