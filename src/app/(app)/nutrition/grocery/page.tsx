import { redirect } from "next/navigation";
import { GROCERY_GENERATOR_ENABLED } from "@/lib/features";
import { GroceryListBoard } from "@/components/nutrition/grocery-list-board";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function GroceryPage() {
  if (!GROCERY_GENERATOR_ENABLED) redirect("/nutrition");

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/nutrition"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 text-muted-foreground transition-colors hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-[17px] font-black tracking-tight text-foreground">Grocery List</h1>
      </div>

      <GroceryListBoard />
    </div>
  );
}
