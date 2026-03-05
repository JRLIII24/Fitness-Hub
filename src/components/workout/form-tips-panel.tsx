"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface FormTipsPanelProps {
  exerciseName: string;
  formTips: string[] | null;
}

export function FormTipsPanel({ exerciseName, formTips }: FormTipsPanelProps) {
  const [open, setOpen] = useState(false);

  if (!formTips || formTips.length === 0) return null;

  return (
    <div className="glass-inner rounded-lg">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-primary">
          <Lightbulb className="h-3.5 w-3.5" />
          Form Tips
          <Badge
            variant="secondary"
            className="h-4 px-1.5 text-[10px] bg-primary/10 text-primary border-primary/20"
          >
            {formTips.length}
          </Badge>
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-[rgba(255,255,255,0.06)] px-3 pb-3 pt-2 space-y-2">
          {formTips.map((tip, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="glass-icon-container mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <p className="leading-snug">{tip}</p>
            </div>
          ))}
          <div className="mt-3 flex items-center gap-1.5 glass-inner rounded-md px-2.5 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-accent shrink-0" />
            <span>AI-powered tips for <strong className="text-foreground">{exerciseName}</strong> coming soon</span>
          </div>
        </div>
      )}
    </div>
  );
}
