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
          timezone: string | null;
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
          timezone?: string | null;
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
          timezone?: string | null;
          updated_at?: string;
        };
      };
      body_weight_logs: {
        Row: {
          id: string;
          user_id: string;
          logged_date: string;
          weight_kg: number;
          body_fat_pct: number | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          logged_date: string;
          weight_kg: number;
          body_fat_pct?: number | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          logged_date?: string;
          weight_kg?: number;
          body_fat_pct?: number | null;
          note?: string | null;
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
          is_public: boolean;
          save_count: number;
          primary_muscle_group: string | null;
          training_block: string | null;
          difficulty_level: string | null;
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
          is_public?: boolean;
          save_count?: number;
          primary_muscle_group?: string | null;
          training_block?: string | null;
          difficulty_level?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          color?: string | null;
          estimated_duration_min?: number | null;
          is_public?: boolean;
          primary_muscle_group?: string | null;
          training_block?: string | null;
          difficulty_level?: string | null;
          updated_at?: string;
        };
      };
      template_saves: {
        Row: {
          id: string;
          template_id: string;
          user_id: string;
          saved_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          user_id: string;
          saved_at?: string;
        };
        Update: {
          saved_at?: string;
        };
      };
      pod_challenges: {
        Row: {
          id: string;
          pod_id: string;
          name: string;
          challenge_type: "volume" | "consistency" | "distance";
          start_date: string;
          end_date: string;
          target_value: number | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          pod_id: string;
          name: string;
          challenge_type: "volume" | "consistency" | "distance";
          start_date: string;
          end_date: string;
          target_value?: number | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          challenge_type?: "volume" | "consistency" | "distance";
          start_date?: string;
          end_date?: string;
          target_value?: number | null;
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
          session_rpe: number | null;
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
          session_rpe?: number | null;
          notes?: string | null;
          total_volume_kg?: number | null;
          created_at?: string;
        };
        Update: {
          name?: string;
          status?: "in_progress" | "completed" | "cancelled";
          completed_at?: string | null;
          duration_seconds?: number | null;
          session_rpe?: number | null;
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
          rir: number | null;
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
          rir?: number | null;
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
          rir?: number | null;
          rest_seconds?: number | null;
          completed_at?: string | null;
          notes?: string | null;
          sort_order?: number;
        };
      };
      fatigue_daily_checkins: {
        Row: {
          id: string;
          user_id: string;
          checkin_date: string;
          timezone: string;
          sleep_quality: number;
          soreness: number;
          stress: number;
          motivation: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          checkin_date: string;
          timezone: string;
          sleep_quality: number;
          soreness: number;
          stress: number;
          motivation: number;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          checkin_date?: string;
          timezone?: string;
          sleep_quality?: number;
          soreness?: number;
          stress?: number;
          motivation?: number;
          notes?: string | null;
          updated_at?: string;
        };
      };
      fatigue_daily_scores: {
        Row: {
          id: string;
          user_id: string;
          score_date: string;
          timezone: string;
          fatigue_score: number;
          load_subscore: number;
          recovery_subscore: number;
          performance_subscore: number;
          strain: number | null;
          session_load_today: number | null;
          avg_load_7d: number | null;
          avg_load_28d: number | null;
          performance_delta: number | null;
          inputs: Json;
          recommendation: string;
          confidence: "low" | "medium" | "high";
          computed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score_date: string;
          timezone: string;
          fatigue_score: number;
          load_subscore: number;
          recovery_subscore: number;
          performance_subscore: number;
          strain?: number | null;
          session_load_today?: number | null;
          avg_load_7d?: number | null;
          avg_load_28d?: number | null;
          performance_delta?: number | null;
          inputs?: Json;
          recommendation: string;
          confidence: "low" | "medium" | "high";
          computed_at?: string;
        };
        Update: {
          score_date?: string;
          timezone?: string;
          fatigue_score?: number;
          load_subscore?: number;
          recovery_subscore?: number;
          performance_subscore?: number;
          strain?: number | null;
          session_load_today?: number | null;
          avg_load_7d?: number | null;
          avg_load_28d?: number | null;
          performance_delta?: number | null;
          inputs?: Json;
          recommendation?: string;
          confidence?: "low" | "medium" | "high";
          computed_at?: string;
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
    Views: {
      template_last_performed: {
        Row: {
          template_id: string;
          last_performed_at: string | null;
        };
      };
    };
    Functions: {
      get_pod_challenge_leaderboard: {
        Args: { p_challenge_id: string };
        Returns: Array<{
          user_id: string;
          display_name: string | null;
          avatar_url: string | null;
          score: number;
          rank: number;
          workouts_cnt: number;
        }>;
      };
      get_exercise_trendlines: {
        Args: { p_user_id: string; p_exercise_ids: string[] };
        Returns: Array<{
          exercise_id: string;
          session_rank: number;
          top_set_weight_kg: number;
        }>;
      };
      get_dashboard_nutrition_summary: {
        Args: { p_user_id: string; p_date_str: string };
        Returns: Array<{
          total_calories: number;
          total_protein_g: number;
          total_carbs_g: number;
          total_fat_g: number;
          total_fiber_g: number;
          total_sugar_g: number;
          total_sodium_mg: number;
          total_servings: number;
        }>;
      };
      get_dashboard_workout_summary: {
        Args: { p_user_id: string; p_days_back?: number };
        Returns: Array<{
          total_sessions: number;
          sessions_7d: number;
          sessions_28d: number;
          avg_volume_28d: number;
          latest_id: string | null;
          latest_name: string | null;
          latest_started_at: string | null;
          latest_duration: number | null;
          latest_volume_kg: number | null;
        }>;
      };
      get_muscle_group_recovery: {
        Args: { p_user_id: string; p_lookback_days?: number };
        Returns: Array<{
          muscle_group: string;
          last_trained_at: string | null;
          hours_since_trained: number | null;
          total_sets: number;
          total_volume_kg: number;
          avg_rpe: number | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
