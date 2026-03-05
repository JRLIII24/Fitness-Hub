import { redirect } from "next/navigation";
import { FOOD_SCANNER_ENABLED } from "@/lib/features";
import { FoodScanner } from "@/components/nutrition/food-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function FoodScanPage() {
  if (!FOOD_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Food Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Take a photo of your meal and we&apos;ll estimate the macros for each item. You can review and adjust before logging.
      </p>

      <FoodScanner />
    </div>
  );
}
