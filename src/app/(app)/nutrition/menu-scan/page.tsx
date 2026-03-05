import { redirect } from "next/navigation";
import { MENU_SCANNER_ENABLED } from "@/lib/features";
import { MenuScanner } from "@/components/nutrition/menu-scanner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function MenuScanPage() {
  if (!MENU_SCANNER_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Menu Scanner</h1>
      </div>

      <p className="mb-4 text-[13px] text-muted-foreground">
        Snap a photo of a restaurant menu and get personalized meal recommendations based on your remaining macros.
      </p>

      <MenuScanner />
    </div>
  );
}
