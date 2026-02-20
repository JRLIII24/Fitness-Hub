export interface Exercise {
  id: string;
  name: string;
  slug: string;
  muscle_group: string;
  equipment: string | null;
  category: string;
  instructions: string | null;
  form_tips: string[] | null;
  image_url: string | null;
  gif_url?: string | null;
}

export interface WorkoutSet {
  id: string;
  exercise_id: string;
  set_number: number;
  set_type: "warmup" | "working" | "dropset" | "failure";
  reps: number | null;
  weight_kg: number | null;
  duration_seconds: number | null;
  rpe: number | null;
  rest_seconds: number | null;
  completed: boolean;
  completed_at: string | null;
}

export interface WorkoutExercise {
  exercise: Exercise;
  sets: WorkoutSet[];
  collapsed: boolean;
  notes: string;
}

export interface ActiveWorkout {
  id: string;
  name: string;
  template_id: string | null;
  started_at: string;
  exercises: WorkoutExercise[];
  notes: string;
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  template_id: string | null;
  name: string;
  status: "in_progress" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  notes: string | null;
  total_volume_kg: number | null;
}

export interface WorkoutTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  estimated_duration_min: number | null;
  exercises: TemplateExercise[];
}

export interface TemplateExercise {
  id: string;
  exercise_id: string;
  exercise?: Exercise;
  sort_order: number;
  target_sets: number | null;
  target_reps: string | null;
  target_weight_kg: number | null;
  rest_seconds: number;
  notes: string | null;
}
