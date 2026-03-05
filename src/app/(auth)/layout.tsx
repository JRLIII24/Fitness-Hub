import { Dumbbell } from "lucide-react";
import { PageTransition } from "@/components/layout/page-transition";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/8 blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-primary/5 blur-[80px]" />
      </div>
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
