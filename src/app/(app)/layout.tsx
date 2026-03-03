import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { ThemeApplier } from "@/components/theme-applier";
import { PageTransition } from "@/components/layout/page-transition";
import { OfflineBanner } from "@/components/layout/offline-banner";
import { SplashDismisser } from "@/components/layout/splash-dismisser";
import { HealthGuard } from "@/components/layout/health-guard";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-svh bg-background">
      <ThemeApplier />
      <OfflineBanner />
      {/* pb accounts for bottom-nav height (6rem) + device safe-area inset.
          env(safe-area-inset-bottom,0px) is 0 on Android/desktop and up to
          34px on iPhone 14 Pro+, ensuring content is never hidden behind the
          nav or the home indicator on any device. */}
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom,0px))]">
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
      <SplashDismisser />
      <HealthGuard />
    </div>
  );
}
