"use client";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

const LEVELS = [
  { id: "beginner" as const, label: "Beginner", desc: "Less than 1 year of training" },
  { id: "intermediate" as const, label: "Intermediate", desc: "1-3 years of consistent training" },
  { id: "advanced" as const, label: "Advanced", desc: "3+ years with structured programming" },
];

export function StepExperience({
  selected,
  onChange,
}: {
  selected: "beginner" | "intermediate" | "advanced" | null;
  onChange: (val: "beginner" | "intermediate" | "advanced") => void;
}) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-lg font-black">Your experience level</h2>
        <p className="text-[13px] text-muted-foreground">This helps personalize your workout recommendations.</p>
      </div>
      <div className="space-y-2.5">
        {LEVELS.map((level) => (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={cn(
              "w-full rounded-xl border p-4 text-left transition-all",
              selected === level.id
                ? "border-primary bg-primary/10"
                : "border-border/60 bg-card/40 hover:border-border"
            )}
          >
            <p className="text-[13px] font-bold text-foreground">{level.label}</p>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{level.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
