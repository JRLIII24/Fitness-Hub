import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeApplier } from "@/components/theme-applier";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-svh bg-background">
      <ThemeApplier />
      <main>{children}</main>
    </div>
  );
}
