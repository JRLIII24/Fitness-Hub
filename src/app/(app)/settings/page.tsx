import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

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

      <ProfileForm
        profile={profile}
        email={user.email ?? ""}
        userId={user.id}
      />

      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-primary" />
            Analytics
          </CardTitle>
          <CardDescription className="text-xs">
            View your Smart Launcher performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/analytics">
            <Button variant="outline" className="w-full justify-between">
              View Launcher Analytics
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
