"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";

interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (exercise: Exercise) => void;
}

export function CreateCustomExerciseDialog({ open, onClose, onCreated }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [muscleGroup, setMuscleGroup] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Exercise name is required");
      return;
    }
    if (!muscleGroup) {
      toast.error("Please select a muscle group");
      return;
    }
    if (!equipment) {
      toast.error("Please select equipment type");
      return;
    }
    if (!category) {
      toast.error("Please select a category");
      return;
    }

    setCreating(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("You must be logged in to create exercises");
        return;
      }

      // Generate slug from name (simple kebab-case)
      const slug = name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

      // Insert the custom exercise
      const { data, error } = await supabase
        .from("exercises")
        .insert({
          name: name.trim(),
          slug: `${slug}-${Date.now()}`, // Add timestamp to ensure uniqueness
          muscle_group: muscleGroup,
          equipment: equipment,
          category: category,
          is_custom: true,
          created_by: user.id,
        })
        .select("id, name, muscle_group, equipment")
        .single();

      if (error) throw error;

      toast.success("Custom exercise created!");
      onCreated(data);

      // Reset form
      setName("");
      setMuscleGroup("");
      setEquipment("");
      setCategory("");
      onClose();
    } catch (err) {
      console.error("Failed to create exercise:", err);
      toast.error("Failed to create exercise");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Custom Exercise</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="ex-name">Exercise Name *</Label>
            <Input
              id="ex-name"
              placeholder="e.g. Landmine Press"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="muscle-group">Muscle Group *</Label>
            <Select value={muscleGroup} onValueChange={setMuscleGroup}>
              <SelectTrigger id="muscle-group">
                <SelectValue placeholder="Select muscle group" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chest">Chest</SelectItem>
                <SelectItem value="back">Back</SelectItem>
                <SelectItem value="legs">Legs</SelectItem>
                <SelectItem value="shoulders">Shoulders</SelectItem>
                <SelectItem value="arms">Arms</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="full_body">Full Body</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="equipment">Equipment *</Label>
            <Select value={equipment} onValueChange={setEquipment}>
              <SelectTrigger id="equipment">
                <SelectValue placeholder="Select equipment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="barbell">Barbell</SelectItem>
                <SelectItem value="dumbbell">Dumbbell</SelectItem>
                <SelectItem value="cable">Cable</SelectItem>
                <SelectItem value="machine">Machine</SelectItem>
                <SelectItem value="bodyweight">Bodyweight</SelectItem>
                <SelectItem value="band">Band</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="compound">Compound</SelectItem>
                <SelectItem value="isolation">Isolation</SelectItem>
                <SelectItem value="cardio">Cardio</SelectItem>
                <SelectItem value="stretch">Stretch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button type="button" onClick={handleCreate} disabled={creating}>
            {creating ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Exercise"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
