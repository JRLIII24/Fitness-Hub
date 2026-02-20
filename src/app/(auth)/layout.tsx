import { Dumbbell } from "lucide-react";
import { PageTransition } from "@/components/layout/page-transition";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="mb-8 flex items-center gap-2">
        <Dumbbell className="size-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight text-foreground">
          FitHub
        </span>
      </div>
      <div className="w-full max-w-sm">
        <PageTransition>{children}</PageTransition>
      </div>
    </div>
  );
}
