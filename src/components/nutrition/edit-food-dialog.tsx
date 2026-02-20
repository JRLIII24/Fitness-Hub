"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FoodLogEntry {
  id: string;
  meal_type: "breakfast" | "lunch" | "dinner" | "snack";
  servings: number;
  food_name?: string;
  food_items?: {
    name: string;
  } | null;
}

interface Props {
  open: boolean;
  entry: FoodLogEntry | null;
  onClose: () => void;
  onSave: (entryId: string, updates: { meal_type: string; servings: number }) => Promise<void>;
}

export function EditFoodDialog({ open, entry, onClose, onSave }: Props) {
  const [saving, setSaving] = useState(false);
  const [mealType, setMealType] = useState<string>(entry?.meal_type ?? "breakfast");
  const [servings, setServings] = useState<string>(String(entry?.servings ?? 1));

  const displayName = entry?.food_name || entry?.food_items?.name || "Food";

  async function handleSave() {
    if (!entry) return;

    setSaving(true);
    try {
      const servingsNum = parseFloat(servings);
      if (servingsNum <= 0) {
        alert("Servings must be greater than 0");
        setSaving(false);
        return;
      }

      await onSave(entry.id, {
        meal_type: mealType,
        servings: servingsNum,
      });

      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!entry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Food Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{displayName}</p>

          <div className="space-y-2">
            <Label htmlFor="meal-type">Meal Type</Label>
            <Select value={mealType} onValueChange={setMealType}>
              <SelectTrigger id="meal-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="breakfast">Breakfast</SelectItem>
                <SelectItem value="lunch">Lunch</SelectItem>
                <SelectItem value="dinner">Dinner</SelectItem>
                <SelectItem value="snack">Snack</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Servings</Label>
            <Input
              id="servings"
              type="number"
              step="0.25"
              min="0.25"
              value={servings}
              onChange={(e) => setServings(e.target.value)}
              placeholder="Servings"
            />
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
              "Save Changes"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
