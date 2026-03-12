import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { format } from "date-fns";
import { LayoutList, Plus } from "lucide-react";
import { MUSCLE_GROUP_LABELS } from "@/lib/constants";
import { TemplatesManagerClient } from "./templates-manager-client";

export type MyTemplate = {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  estimated_duration_min: number | null;
  is_public: boolean;
  save_count: number;
  primary_muscle_group: string | null;
  training_block: string | null;
  created_at: string;
  exercise_count: number;
};

export default async function MyTemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch templates with exercise count
  const { data: templates } = await supabase
    .from("workout_templates")
    .select(`
      id, name, description, color, estimated_duration_min,
      is_public, save_count, primary_muscle_group, training_block, created_at,
      template_exercises(id)
    `)
    .eq("user_id", user.id)
    .is("program_id", null)
    .order("updated_at", { ascending: false });

  type RawTemplate = {
    id: string;
    name: string;
    description: string | null;
    color: string | null;
    estimated_duration_min: number | null;
    is_public: boolean;
    save_count: number;
    primary_muscle_group: string | null;
    training_block: string | null;
    created_at: string;
    template_exercises: { id: string }[];
  };

  const myTemplates: MyTemplate[] = ((templates ?? []) as unknown as RawTemplate[]).map((t) => ({
    ...t,
    exercise_count: t.template_exercises?.length ?? 0,
  }));

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-28 pt-6">
      <div className="flex items-center gap-2">
        <LayoutList className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-bold">My Templates</h1>
        <Link
          href="/workout"
          className="ml-auto flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New Workout
        </Link>
      </div>

      {myTemplates.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <LayoutList className="h-12 w-12 text-muted-foreground/40" />
          <p className="mt-4 text-lg font-semibold">No templates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete a workout and save it as a template to see it here.
          </p>
        </div>
      ) : (
        <TemplatesManagerClient
          templates={myTemplates}
          muscleGroupLabels={MUSCLE_GROUP_LABELS}
        />
      )}
    </div>
  );
}
