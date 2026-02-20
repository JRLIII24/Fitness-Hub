export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          date_of_birth: string | null;
          gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal?:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal?:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          updated_at?: string;
        };
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          slug: string;
          muscle_group: string;
          equipment: string;
          category: string;
          instructions: string | null;
          form_tips: string[] | null;
          image_url: string | null;
          is_custom: boolean;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          muscle_group: string;
          equipment: string;
          category: string;
          instructions?: string | null;
          form_tips?: string[] | null;
          image_url?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          slug?: string;
          muscle_group?: string;
          equipment?: string;
          category?: string;
          instructions?: string | null;
          form_tips?: string[] | null;
          image_url?: string | null;
          is_custom?: boolean;
        };
      };
      workout_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          color: string | null;
          estimated_duration_min: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          color?: string | null;
          estimated_duration_min?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string | null;
          estimated_duration_min?: number | null;
          updated_at?: string;
        };
      };
      template_exercises: {
        Row: {
          id: string;
          template_id: string;
          exercise_id: string;
          sort_order: number;
          target_sets: number | null;
          target_reps: string | null;
          target_weight_kg: number | null;
          rest_seconds: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          template_id: string;
          exercise_id: string;
          sort_order: number;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight_kg?: number | null;
          rest_seconds?: number;
          notes?: string | null;
        };
        Update: {
          sort_order?: number;
          target_sets?: number | null;
          target_reps?: string | null;
          target_weight_kg?: number | null;
          rest_seconds?: number;
          notes?: string | null;
        };
      };
      workout_sessions: {
        Row: {
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
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          template_id?: string | null;
          name: string;
          status?: "in_progress" | "completed" | "cancelled";
          started_at?: string;
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          total_volume_kg?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          status?: "in_progress" | "completed" | "cancelled";
          completed_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          total_volume_kg?: number | null;
        };
      };
      workout_sets: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          set_type: "warmup" | "working" | "dropset" | "failure";
          reps: number | null;
          weight_kg: number | null;
          duration_seconds: number | null;
          rpe: number | null;
          rest_seconds: number | null;
          completed_at: string | null;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          set_number: number;
          set_type?: "warmup" | "working" | "dropset" | "failure";
          reps?: number | null;
          weight_kg?: number | null;
          duration_seconds?: number | null;
          rpe?: number | null;
          rest_seconds?: number | null;
          completed_at?: string | null;
          notes?: string | null;
          sort_order: number;
        };
        Update: {
          set_number?: number;
          set_type?: "warmup" | "working" | "dropset" | "failure";
          reps?: number | null;
          weight_kg?: number | null;
          duration_seconds?: number | null;
          rpe?: number | null;
          rest_seconds?: number | null;
          completed_at?: string | null;
          notes?: string | null;
          sort_order?: number;
        };
      };
      food_items: {
        Row: {
          id: string;
          barcode: string | null;
          name: string;
          brand: string | null;
          serving_size_g: number | null;
          serving_description: string | null;
          calories_per_serving: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          fiber_g: number | null;
          sugar_g: number | null;
          sodium_mg: number | null;
          source: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          barcode?: string | null;
          name: string;
          brand?: string | null;
          serving_size_g?: number | null;
          serving_description?: string | null;
          calories_per_serving: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          sugar_g?: number | null;
          sodium_mg?: number | null;
          source?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          barcode?: string | null;
          name?: string;
          brand?: string | null;
          serving_size_g?: number | null;
          serving_description?: string | null;
          calories_per_serving?: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          fiber_g?: number | null;
          sugar_g?: number | null;
          sodium_mg?: number | null;
          source?: string;
        };
      };
      nutrition_goals: {
        Row: {
          id: string;
          user_id: string;
          calories_target: number | null;
          protein_g_target: number | null;
          carbs_g_target: number | null;
          fat_g_target: number | null;
          fiber_g_target: number | null;
          effective_from: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          calories_target?: number | null;
          protein_g_target?: number | null;
          carbs_g_target?: number | null;
          fat_g_target?: number | null;
          fiber_g_target?: number | null;
          effective_from?: string;
          created_at?: string;
        };
        Update: {
          calories_target?: number | null;
          protein_g_target?: number | null;
          carbs_g_target?: number | null;
          fat_g_target?: number | null;
          fiber_g_target?: number | null;
          effective_from?: string;
        };
      };
      food_log: {
        Row: {
          id: string;
          user_id: string;
          food_item_id: string;
          logged_at: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack";
          servings: number;
          calories_consumed: number;
          protein_g: number | null;
          carbs_g: number | null;
          fat_g: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_item_id: string;
          logged_at?: string;
          meal_type: "breakfast" | "lunch" | "dinner" | "snack";
          servings?: number;
          calories_consumed: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          meal_type?: "breakfast" | "lunch" | "dinner" | "snack";
          servings?: number;
          calories_consumed?: number;
          protein_g?: number | null;
          carbs_g?: number | null;
          fat_g?: number | null;
          notes?: string | null;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
