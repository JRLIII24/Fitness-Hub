"use client";

import { useState } from "react";
import { Trash2, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { MACRO_COLORS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EditFoodDialog } from "./edit-food-dialog";

interface FoodLogEntry {
  id: string;
  food_item_id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  calories_consumed: number;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  logged_at: string;
  // Food item details (either flattened or nested)
  food_name?: string;
  food_brand?: string;
  serving_description?: string;
  food_items?: {
    name: string;
    brand: string | null;
    serving_description: string | null;
    serving_size_g?: number | null;
    fiber_g?: number | null;
    sugar_g?: number | null;
    sodium_mg?: number | null;
    source?: string | null;
  } | null;
}

interface Props {
  entry: FoodLogEntry;
  onDelete: (entryId: string) => Promise<void>;
  onEdit: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function FoodLogCard({ entry, onDelete, onEdit }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this food entry?")) return;

    setDeleting(true);
    try {
      await onDelete(entry.id);
      toast.success("Food entry deleted");
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete entry");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditSave = async (entryId: string, updates: { meal_type: string; servings: number }) => {
    try {
      await onEdit(entryId, updates);
      toast.success("Food entry updated");
    } catch (err) {
      console.error(err);
      toast.error("Failed to update entry");
      throw err;
    }
  };

  const displayName = entry.food_name || entry.food_items?.name || "Unknown Food";
  const displayBrand = entry.food_brand || entry.food_items?.brand;
  const displayServing = entry.serving_description || entry.food_items?.serving_description || (entry.servings ? `${entry.servings}x serving` : "1 serving");
  const totalFiber = (entry.food_items?.fiber_g ?? 0) * (entry.servings ?? 1);
  const totalSugar = (entry.food_items?.sugar_g ?? 0) * (entry.servings ?? 1);
  const totalSodium = (entry.food_items?.sodium_mg ?? 0) * (entry.servings ?? 1);
  const sourceLabel = entry.food_items?.source;

  return (
    <>
      <div className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground truncate">{displayName}</p>
          {displayBrand && (
            <p className="text-xs text-muted-foreground truncate">{displayBrand}</p>
          )}
          <p className="text-xs text-muted-foreground mt-0.5">{displayServing}</p>
          {entry.food_items?.serving_size_g != null && (
            <p className="text-[11px] text-muted-foreground">
              ~{Math.round(entry.food_items.serving_size_g * (entry.servings ?? 1) * 10) / 10}g total
            </p>
          )}

          {(entry.protein_g != null || entry.carbs_g != null || entry.fat_g != null) && (
            <div className="mt-1.5 flex gap-3 text-xs text-muted-foreground">
              {entry.protein_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.protein}`}>P</span> {Math.round(entry.protein_g)}g
                </span>
              )}
              {entry.carbs_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.carbs}`}>C</span> {Math.round(entry.carbs_g)}g
                </span>
              )}
              {entry.fat_g != null && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fat}`}>F</span> {Math.round(entry.fat_g)}g
                </span>
              )}
            </div>
          )}
          {(totalFiber > 0 || totalSugar > 0 || totalSodium > 0) && (
            <div className="mt-1 flex gap-3 text-[11px] text-muted-foreground">
              {totalFiber > 0 && (
                <span>
                  <span className={`font-medium ${MACRO_COLORS.fiber}`}>Fi</span> {Math.round(totalFiber)}g
                </span>
              )}
              {totalSugar > 0 && (
                <span>
                  <span className="font-medium text-rose-400">Su</span> {Math.round(totalSugar)}g
                </span>
              )}
              {totalSodium > 0 && (
                <span>
                  <span className="font-medium text-cyan-400">Na</span> {Math.round(totalSodium)}mg
                </span>
              )}
            </div>
          )}
          {sourceLabel && (
            <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
              {sourceLabel}
            </p>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="text-right">
            <p className="font-bold text-foreground text-sm">{Math.round(entry.calories_consumed)}</p>
            <p className="text-xs text-muted-foreground">kcal</p>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={() => setEditDialogOpen(true)}
              aria-label="Edit entry"
            >
              <Pencil className="size-4 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 shrink-0"
              onClick={handleDelete}
              disabled={deleting}
              aria-label="Delete entry"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4 text-destructive" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <EditFoodDialog
        open={editDialogOpen}
        entry={entry}
        onClose={() => setEditDialogOpen(false)}
        onSave={handleEditSave}
      />
    </>
  );
}
