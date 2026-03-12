/**
 * Types for marketplace program browsing.
 */

export interface PublicProgram {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  goal: string;
  weeks: number;
  days_per_week: number;
  status: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  program_data: any;
  created_at: string;
  creator?: {
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface ProgramDayExercise {
  exercise_name: string;
  muscle_group: string;
  sets: number;
  reps: string;
  rpe_target?: number;
  rest_seconds: number;
}

export interface ProgramDay {
  day_number: number;
  name: string;
  exercises: ProgramDayExercise[];
  template_id?: string;
}

export interface ProgramWeek {
  week_number: number;
  focus: string;
  days: ProgramDay[];
}

export interface ProgramData {
  name: string;
  description: string;
  weeks: ProgramWeek[];
}
