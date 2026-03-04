import React from "react";

interface DashboardCardHeaderProps {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}

export const DashboardCardHeader = React.memo(function DashboardCardHeader({
  icon,
  title,
  action,
}: DashboardCardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-5 py-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-card/70">
          {icon}
        </div>
        <span className="truncate text-[13px] font-bold text-foreground">{title}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
});
