"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { saveTemplateSchema, type SaveTemplateFormData } from "@/lib/schemas";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MUSCLE_FILTERS, getMuscleColor } from "@/lib/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter((f) => f !== "All");

interface Props {
  open: boolean;
  defaultName?: string;
  defaultCategories?: string[];
  onClose: () => void;
  onSave: (name: string, isPublic: boolean, categories: string[]) => Promise<void>;
}

export function SaveTemplateDialog({ open, defaultName = "", defaultCategories = [], onClose, onSave }: Props) {
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [categories, setCategories] = useState<string[]>(defaultCategories);
  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
    reset,
  } = useForm<SaveTemplateFormData>({
    resolver: zodResolver(saveTemplateSchema),
    defaultValues: { name: defaultName },
  });

  const onSubmit = async (data: SaveTemplateFormData) => {
    setLoading(true);
    try {
      await onSave(data.name.trim(), isPublic, categories);
      reset();
      setIsPublic(true);
      setCategories([]);
      onClose();
    } catch (err) {
      setError("name", {
        type: "manual",
        message: err instanceof Error ? err.message : "Failed to save template.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      reset();
      setIsPublic(true);
      setCategories([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="tpl-name">Template name</Label>
            <Input
              id="tpl-name"
              placeholder="e.g. Push Day A"
              autoFocus
              {...register("name")}
              aria-invalid={!!errors.name}
            />
            {errors.name && (
              <p className="text-destructive text-xs">{errors.name.message}</p>
            )}
          </div>

          {/* Category picker — multi-select */}
          <div className="space-y-2">
            <Label>
              Workout Type
              <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                (select one or more)
              </span>
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on = categories.includes(val);
                const gc = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setCategories((prev) =>
                        on ? prev.filter((c) => c !== val) : [...prev, val]
                      );
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha : "rgba(255,255,255,0.04)",
                      border: `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color: on ? gc.labelColor : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Share to Marketplace</p>
              <p className="text-xs text-muted-foreground">Let others discover and save this workout</p>
            </div>
            <Switch
              id="tpl-public"
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => {
              reset();
              setIsPublic(true);
              setCategories([]);
              onClose();
            }}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
