import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronRight, Scale, Dumbbell, LayoutList } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ExportDataCard } from "./export-data-card";
import { NotificationPreferencesCard } from "./notification-preferences-card";
import { SignOutButton } from "./sign-out-button";

const QUICK_ACCESS_LINKS = [
  {
    href: "/body",
    title: "Body Metrics",
    description: "Track weight and body composition over time",
    Icon: Scale,
    cta: "Open Body Metrics",
  },
  {
    href: "/analytics",
    title: "Analytics",
    description: "Review Smart Launcher performance and trends",
    Icon: BarChart3,
    cta: "Open Analytics",
  },
  {
    href: "/workout/templates",
    title: "My Templates",
    description: "Manage and publish your workout templates",
    Icon: LayoutList,
    cta: "Open Templates",
  },
  {
    href: "/exercises",
    title: "Exercise Library",
    description: "Browse all available exercises",
    Icon: Dumbbell,
    cta: "Browse Library",
  },
] as const;

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-28 pt-6">
      <PageHeader title="Settings" />

      <Card className="glass-surface">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Account & Preferences</CardTitle>
          <CardDescription className="text-xs">
            Update your profile, privacy, units, and theme in one place.
          </CardDescription>
        </CardHeader>
      </Card>

      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        userId={user.id}
      />

      <Card className="glass-surface">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <LayoutList className="h-4 w-4 text-primary" />
            Quick Access
          </CardTitle>
          <CardDescription className="text-xs">
            Jump to commonly used areas without leaving settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {QUICK_ACCESS_LINKS.map(({ href, title, description, Icon, cta }) => (
            <Button
              key={href}
              variant="outline"
              className="h-auto w-full justify-between px-3 py-3"
              asChild
            >
              <Link href={href}>
                <span className="flex items-start gap-3 text-left">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <span className="space-y-0.5">
                    <span className="block text-sm font-semibold text-foreground">{title}</span>
                    <span className="block text-xs text-muted-foreground">{description}</span>
                  </span>
                </span>
                <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  {cta}
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      <ExportDataCard />

      <NotificationPreferencesCard />

      <div className="border-t border-border/50 pt-2">
        <div className="flex justify-center">
          <SignOutButton
            label="Sign out of FitHub"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive"
          />
        </div>
      </div>
    </div>
  );
}
