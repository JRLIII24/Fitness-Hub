"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Dumbbell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MUSCLE_GROUPS, EQUIPMENT_TYPES, EXERCISE_CATEGORIES, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";

const CATEGORY_LABELS: Record<string, string> = {
  compound: "Compound",
  isolation: "Isolation",
  cardio: "Cardio",
  stretch: "Stretch / Mobility",
};

export default function NewExercisePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    muscle_group: "",
    equipment: "",
    category: "",
    instructions: "",
  });

  function update(key: string, val: string) {
    setForm((prev) => ({ ...prev, [key]: val }));
  }

  async function handleSubmit() {
    if (!form.name.trim() || !form.muscle_group || !form.equipment || !form.category) {
      toast.error("Please fill in all required fields");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/exercises", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Custom exercise created!");
      router.push("/exercises");
    } else {
      const data = await res.json();
      toast.error(data.error ?? "Failed to create exercise");
    }
    setSaving(false);
  }

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 px-4 pb-28 pt-6">
      <div className="flex items-center gap-3">
        <Link href="/exercises">
          <Button size="icon" variant="ghost" className="size-9">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Dumbbell className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Create Exercise</h1>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card/30 p-4 space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Exercise Name <span className="text-destructive">*</span>
          </Label>
          <Input
            placeholder="e.g. Romanian Deadlift"
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>

        {/* Muscle Group */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Muscle Group <span className="text-destructive">*</span>
          </Label>
          <Select value={form.muscle_group} onValueChange={(v) => update("muscle_group", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select muscle group" />
            </SelectTrigger>
            <SelectContent>
              {MUSCLE_GROUPS.map((mg) => (
                <SelectItem key={mg} value={mg}>
                  {MUSCLE_GROUP_LABELS[mg] ?? mg}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Equipment */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Equipment <span className="text-destructive">*</span>
          </Label>
          <Select value={form.equipment} onValueChange={(v) => update("equipment", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select equipment" />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((eq) => (
                <SelectItem key={eq} value={eq}>
                  {EQUIPMENT_LABELS[eq] ?? eq}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select value={form.category} onValueChange={(v) => update("category", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {EXERCISE_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instructions */}
        <div className="space-y-1.5">
          <Label className="text-sm font-semibold">
            Instructions <span className="text-[11px] font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            placeholder="Describe how to perform the exercise…"
            value={form.instructions}
            onChange={(e) => update("instructions", e.target.value)}
            rows={4}
            className="resize-none text-sm"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full gap-2"
        >
          {saving ? (
            <>
              <div className="size-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Creating…
            </>
          ) : (
            <>
              <Plus className="size-4" />
              Create Exercise
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
