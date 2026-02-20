"use client";

import { cn } from "@/lib/utils";

export interface PillOption<T extends string> {
  value: T;
  label: string;
}

interface PillSelectorProps<T extends string> {
  value: T;
  options: ReadonlyArray<PillOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}

export function PillSelector<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: PillSelectorProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex rounded-full border border-border/60 bg-muted/40 p-1 backdrop-blur-sm", className)}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "min-h-9 flex-1 rounded-full px-3 text-xs font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.98]",
              selected
                ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
