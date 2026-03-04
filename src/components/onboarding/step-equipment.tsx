"use client";
import { cn } from "@/lib/utils";
import { Dumbbell } from "lucide-react";

const EQUIPMENT_OPTIONS = [
  { id: "barbell", label: "Barbell" },
  { id: "dumbbell", label: "Dumbbell" },
  { id: "kettlebell", label: "Kettlebell" },
  { id: "machine", label: "Machine" },
  { id: "cable", label: "Cable" },
  { id: "bodyweight", label: "Bodyweight" },
  { id: "band", label: "Resistance Band" },
  { id: "smith_machine", label: "Smith Machine" },
];

export function StepEquipment({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id]
    );
  };

  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
          <Dumbbell className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-black">What equipment do you have?</h2>
        <p className="text-[13px] text-muted-foreground">Select all that apply. This helps us recommend the right exercises.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {EQUIPMENT_OPTIONS.map((opt) => {
          const isSelected = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              className={cn(
                "rounded-xl border p-3.5 text-left text-[13px] font-semibold transition-all",
                isSelected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:border-border"
              )}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
