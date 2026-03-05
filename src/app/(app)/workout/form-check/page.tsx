import { Camera, Lock } from "lucide-react";
import { FORM_ANALYSIS_ENABLED } from "@/lib/features";

export const metadata = {
  title: "Form Check | Fit Hub",
};

export default function FormCheckPage() {
  if (!FORM_ANALYSIS_ENABLED) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center px-6 text-center">
        {/* Icon */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-border/60 bg-card/30">
          <Camera className="h-9 w-9 text-muted-foreground/60" />
        </div>

        {/* Badge */}
        <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-400">
          <Lock className="h-3 w-3" />
          Coming Soon
        </span>

        {/* Title */}
        <h1 className="mb-2 text-[20px] font-black tracking-tight text-foreground">
          AI Form Analysis
        </h1>

        {/* Description */}
        <p className="max-w-xs text-[13px] leading-relaxed text-muted-foreground">
          We&apos;re working on AI-powered form analysis. Record your lifts and
          get real-time feedback on your technique. Stay tuned!
        </p>
      </div>
    );
  }

  // Future: full form-check implementation
  return (
    <div className="px-4 py-6">
      <h1 className="text-[20px] font-black tracking-tight text-foreground">
        Form Check
      </h1>
      <p className="mt-1 text-[13px] text-muted-foreground">
        Record your lift and get AI feedback on your form.
      </p>
    </div>
  );
}
