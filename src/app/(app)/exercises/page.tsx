import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Dumbbell, Plus } from "lucide-react";
import { MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from "@/lib/constants";
import { ExercisesClient } from "./exercises-client";

export type ExerciseRow = {
  id: string;
  name: string;
  muscle_group: string;
  equipment: string;
  category: string;
  instructions: string | null;
  has_video: boolean;
};

export default async function ExercisesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("exercises")
    .select(`
      id, name, muscle_group, equipment, category, instructions,
      exercise_instructional_videos(count)
    `)
    .order("name", { ascending: true })
    .limit(500);

  const exercises = (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    muscle_group: row.muscle_group,
    equipment: row.equipment,
    category: row.category,
    instructions: row.instructions,
    has_video: (row.exercise_instructional_videos?.[0]?.count ?? 0) > 0,
  })) as ExerciseRow[];

  const muscleGroups = [...new Set(exercises.map((e) => e.muscle_group))].sort();
  const equipmentTypes = [...new Set(exercises.map((e) => e.equipment))].sort();

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 pb-28 pt-6 md:px-6">
      <div className="flex items-center gap-2">
        <Dumbbell className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">Exercise Library</h1>
        <span className="text-sm text-muted-foreground">{exercises.length}</span>
        <Link
          href="/exercises/new"
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create
        </Link>
      </div>

      <ExercisesClient
        exercises={exercises}
        muscleGroups={muscleGroups}
        equipmentTypes={equipmentTypes}
        muscleGroupLabels={MUSCLE_GROUP_LABELS}
        equipmentLabels={EQUIPMENT_LABELS}
      />
    </div>
  );
}
