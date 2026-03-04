import React from "react";

interface StatPillProps {
  icon: React.ReactNode;
  value: number | string;
  label: string;
}

export const StatPill = React.memo(function StatPill({ icon, value, label }: StatPillProps) {
  return (
    <div className="flex flex-col items-center justify-center glass-surface glass-highlight rounded-2xl px-2 py-4 text-center sm:px-3">
      <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-xl bg-card/70">
        {icon}
      </div>
      <span className="tabular-nums text-[22px] font-black leading-none text-foreground sm:text-[26px]">
        {value}
      </span>
      <span className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-widest text-muted-foreground sm:text-[9px]">
        {label}
      </span>
    </div>
  );
});
