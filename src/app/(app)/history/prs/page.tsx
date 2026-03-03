import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Trophy, Medal } from "lucide-react";
import { HistoryNav } from "@/components/history/history-nav";
import { PRsClient } from "./prs-client";

export default async function PRsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch all-time best weight per exercise (working sets only)
  // We join through workout_sessions to filter by user
  const { data: rawPRs } = await supabase
    .from("workout_sets")
    .select(`
      weight_kg,
      reps,
      exercises!inner(id, name, muscle_group),
      workout_sessions!inner(user_id, status, started_at)
    `)
    .eq("workout_sessions.user_id", user.id)
    .eq("workout_sessions.status", "completed")
    .eq("set_type", "working")
    .not("weight_kg", "is", null)
    .gt("weight_kg", 0)
    .order("weight_kg", { ascending: false });

  type RawRow = {
    weight_kg: number | null;
    reps: number | null;
    exercises: { id: string; name: string; muscle_group: string } | { id: string; name: string; muscle_group: string }[] | null;
    workout_sessions: { user_id: string; status: string; started_at: string } | { user_id: string; status: string; started_at: string }[] | null;
  };

  const rows = (rawPRs ?? []) as RawRow[];

  // Aggregate best weight per exercise
  const prMap = new Map<string, { id: string; name: string; muscle_group: string; pr_kg: number; reps: number | null; achieved_at: string }>();

  for (const row of rows) {
    const ex = Array.isArray(row.exercises) ? row.exercises[0] : row.exercises;
    const sess = Array.isArray(row.workout_sessions) ? row.workout_sessions[0] : row.workout_sessions;
    if (!ex || !row.weight_kg) continue;

    const existing = prMap.get(ex.id);
    if (!existing || row.weight_kg > existing.pr_kg) {
      prMap.set(ex.id, {
        id: ex.id,
        name: ex.name,
        muscle_group: ex.muscle_group,
        pr_kg: row.weight_kg,
        reps: row.reps,
        achieved_at: sess?.started_at ?? "",
      });
    }
  }

  const prs = [...prMap.values()].sort((a, b) => {
    if (a.muscle_group < b.muscle_group) return -1;
    if (a.muscle_group > b.muscle_group) return 1;
    return b.pr_kg - a.pr_kg;
  });

  const muscleGroups = [...new Set(prs.map((p) => p.muscle_group))].sort();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">Personal Records</h1>
        </div>
        <HistoryNav />
      </div>

      {prs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Medal className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No PRs yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete workouts with weighted sets to see your all-time records here.
          </p>
        </div>
      ) : (
        <PRsClient prs={prs} muscleGroups={muscleGroups} />
      )}
    </div>
  );
}
