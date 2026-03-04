import Link from "next/link";
import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center px-6 text-center">
      <div className="w-full max-w-sm rounded-2xl border border-border/60 bg-card/30 p-8">
        <SearchX className="mx-auto mb-4 size-10 text-muted-foreground" />
        <h2 className="mb-2 text-[13px] font-bold text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-[12px] text-muted-foreground">
          This page doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-[12px] font-bold text-primary-foreground"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
