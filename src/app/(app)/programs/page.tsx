import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProgramsClient } from "./programs-client";

export default async function ProgramsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: programs } = await supabase
    .from("training_programs")
    .select("id, name, description, goal, weeks, days_per_week, status, current_week, current_day, started_at, completed_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return <ProgramsClient initialPrograms={programs ?? []} />;
}
