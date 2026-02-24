"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getMuscleColor, MUSCLE_FILTERS } from "@/components/marketplace/muscle-colors";

const CATEGORY_OPTIONS = MUSCLE_FILTERS.filter(f => f !== "All");

interface WorkoutTemplate {
  id: string;
  name: string;
  description: string | null;
  primary_muscle_group?: string | null;
}

interface Props {
  open: boolean;
  template: WorkoutTemplate | null;
  onClose: () => void;
  onSave: (updates: { name: string; description: string | null; primary_muscle_group: string | null }) => Promise<void>;
}

export function EditTemplateDialog({ open, template, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [primaryMuscleGroup, setPrimaryMuscleGroup] = useState<string | null>(null);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setDescription(template.description || "");
      setPrimaryMuscleGroup(template.primary_muscle_group ?? null);
    }
  }, [template, open]);

  async function handleSave() {
    if (!name.trim()) {
      alert("Template name is required");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        primary_muscle_group: primaryMuscleGroup,
      });
    } finally {
      setSaving(false);
    }
  }

  if (!template) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push Day A"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this workout..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((cat) => {
                const val = cat.toLowerCase();
                const on  = primaryMuscleGroup === val;
                const gc  = getMuscleColor(val);
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPrimaryMuscleGroup(on ? null : val)}
                    className="rounded-full px-3 py-1 text-[11px] font-semibold transition-all duration-150"
                    style={{
                      background: on ? gc.bgAlpha      : "rgba(255,255,255,0.04)",
                      border:     `1px solid ${on ? gc.borderAlpha : "rgba(255,255,255,0.1)"}`,
                      color:      on ? gc.labelColor   : "hsl(var(--muted-foreground))",
                      fontWeight: on ? 700 : 500,
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
