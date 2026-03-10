import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsClient } from "./reports-client";

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // weekly_reports not yet in generated DB types — cast to any
  const { data: reports } = await (supabase as any)
    .from("weekly_reports")
    .select("id, week_start, report_json, generated_at")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false })
    .limit(20);

  return <ReportsClient initialReports={reports ?? []} />;
}
