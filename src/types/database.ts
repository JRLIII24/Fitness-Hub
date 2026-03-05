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
          current_weight_kg: number | null;
          goal_weight_kg: number | null;
          date_of_birth: string | null;
          gender: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          timezone: string | null;
          unit_preference: "metric" | "imperial" | null;
          show_weight: boolean | null;
          onboarding_completed: boolean | null;
          theme_preference: string | null;
          accent_color: string | null;
          equipment_available: string[] | null;
          experience_level: "beginner" | "intermediate" | "advanced" | null;
          activity_level: string | null;
          feature_flags: Record<string, boolean> | null;
          xp: number;
          level: number;
          current_streak: number;
          streak_milestones_unlocked: number[] | null;
          streak_freeze_available: boolean;
          username: string | null;
          is_public: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          current_weight_kg?: number | null;
          goal_weight_kg?: number | null;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal?:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          timezone?: string | null;
          unit_preference?: "metric" | "imperial" | null;
          show_weight?: boolean | null;
          onboarding_completed?: boolean | null;
          theme_preference?: string | null;
          accent_color?: string | null;
          equipment_available?: string[] | null;
          experience_level?: "beginner" | "intermediate" | "advanced" | null;
          activity_level?: string | null;
          feature_flags?: Record<string, boolean> | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          current_weight_kg?: number | null;
          goal_weight_kg?: number | null;
          date_of_birth?: string | null;
          gender?: "male" | "female" | "other" | "prefer_not_to_say" | null;
          fitness_goal?:
            | "lose_weight"
            | "build_muscle"
            | "maintain"
            | "improve_endurance"
            | null;
          timezone?: string | null;
          unit_preference?: "metric" | "imperial" | null;
          show_weight?: boolean | null;
          onboarding_completed?: boolean | null;
          theme_preference?: string | null;
          accent_color?: string | null;
          equipment_available?: string[] | null;
          experience_level?: "beginner" | "intermediate" | "advanced" | null;
          activity_level?: string | null;
          feature_flags?: Record<string, boolean> | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      pro_waitlist: {
        Row: {
          id: string;
          user_id: string | null;
          email: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          email: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          email?: string;
        };
        Relationships: [];
      };
      grocery_lists: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          week_start: string;
          items: Json;
          ai_summary: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          week_start: string;
          items?: Json;
          ai_summary?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          week_start?: string;
          items?: Json;
          ai_summary?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      meal_templates: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          items: Json;
          total_calories: number;
          total_protein_g: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          items: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          items?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_measurements: {
        Row: {
          id: string;
          user_id: string;
          measured_date: string;
          waist_cm: number | null;
          chest_cm: number | null;
          hips_cm: number | null;
          left_arm_cm: number | null;
          right_arm_cm: number | null;
          left_thigh_cm: number | null;
          right_thigh_cm: number | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          measured_date: string;
          waist_cm?: number | null;
          chest_cm?: number | null;
          hips_cm?: number | null;
          left_arm_cm?: number | null;
          right_arm_cm?: number | null;
          left_thigh_cm?: number | null;
          right_thigh_cm?: number | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          measured_date?: string;
          waist_cm?: number | null;
          chest_cm?: number | null;
          hips_cm?: number | null;
          left_arm_cm?: number | null;
          right_arm_cm?: number | null;
          left_thigh_cm?: number | null;
          right_thigh_cm?: number | null;
          note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      pod_challenges: {
        Row: {
          id: string;
          pod_id: string;
          name: string;
          challenge_type: "volume" | "consistency";
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
          challenge_type: "volume" | "consistency";
          start_date: string;
          end_date: string;
          target_value?: number | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          challenge_type?: "volume" | "consistency";
          start_date?: string;
          end_date?: string;
          target_value?: number | null;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
      readiness_daily_scores: {
        Row: {
          id: string;
          user_id: string;
          score_date: string;
          readiness_score: number;
          training_score: number | null;
          nutrition_score: number | null;
          recovery_score: number | null;
          external_score: number | null;
          confidence: "low" | "medium" | "high";
          recommendation: string;
          computed_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          score_date: string;
          readiness_score: number;
          training_score?: number | null;
          nutrition_score?: number | null;
          recovery_score?: number | null;
          external_score?: number | null;
          confidence: "low" | "medium" | "high";
          recommendation: string;
          computed_at?: string;
        };
        Update: {
          score_date?: string;
          readiness_score?: number;
          training_score?: number | null;
          nutrition_score?: number | null;
          recovery_score?: number | null;
          external_score?: number | null;
          confidence?: "low" | "medium" | "high";
          recommendation?: string;
          computed_at?: string;
        };
        Relationships: [];
      };
      health_sync_data: {
        Row: {
          id: string;
          user_id: string;
          sync_date: string;
          sleep_hours: number | null;
          resting_heart_rate: number | null;
          hrv_ms: number | null;
          steps: number | null;
          source: "healthkit" | "google_fit" | "manual";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          sync_date: string;
          sleep_hours?: number | null;
          resting_heart_rate?: number | null;
          hrv_ms?: number | null;
          steps?: number | null;
          source: "healthkit" | "google_fit" | "manual";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sync_date?: string;
          sleep_hours?: number | null;
          resting_heart_rate?: number | null;
          hrv_ms?: number | null;
          steps?: number | null;
          source?: "healthkit" | "google_fit" | "manual";
          updated_at?: string;
        };
        Relationships: [];
      };
      push_device_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: 'ios' | 'android' | 'web';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          token?: string;
          platform?: 'ios' | 'android' | 'web';
          updated_at?: string;
        };
        Relationships: [];
      };
      streak_risk_alerts: {
        Row: {
          id: string;
          user_id: string;
          alert_date: string;
          risk_level: 'warning' | 'critical';
          streak_count: number;
          notified_pod_member_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          alert_date: string;
          risk_level: 'warning' | 'critical';
          streak_count: number;
          notified_pod_member_ids?: string[];
          created_at?: string;
        };
        Update: {
          user_id?: string;
          alert_date?: string;
          risk_level?: 'warning' | 'critical';
          streak_count?: number;
          notified_pod_member_ids?: string[];
        };
        Relationships: [];
      };
      notification_preferences: {
        Row: {
          id: string;
          user_id: string;
          streak_alerts_enabled: boolean;
          pod_pings_enabled: boolean;
          workout_reminders_enabled: boolean;
          quiet_hours_start: number | null;
          quiet_hours_end: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          streak_alerts_enabled?: boolean;
          pod_pings_enabled?: boolean;
          workout_reminders_enabled?: boolean;
          quiet_hours_start?: number | null;
          quiet_hours_end?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          streak_alerts_enabled?: boolean;
          pod_pings_enabled?: boolean;
          workout_reminders_enabled?: boolean;
          quiet_hours_start?: number | null;
          quiet_hours_end?: number | null;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
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
        Relationships: [];
      };
    };
    Views: {
      template_last_performed: {
        Row: {
          template_id: string;
          last_performed_at: string | null;
        };
        Relationships: [];
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
      get_nutrition_compliance: {
        Args: { p_user_id: string; p_days?: number };
        Returns: Array<{
          days_tracked: number;
          avg_calorie_pct: number;
          avg_protein_pct: number;
        }>;
      };
      detect_streak_risk_users: {
        Args: Record<string, never>;
        Returns: Array<{
          user_id: string;
          display_name: string | null;
          current_streak: number;
          hours_since_last_workout: number;
          risk_level: string;
          pod_ids: string[];
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
      get_food_log_summary_for_grocery: {
        Args: { p_days_back?: number };
        Returns: Array<{
          food_name: string;
          total_servings: number;
          avg_daily_servings: number;
          serving_size_g: number | null;
          serving_description: string | null;
          times_logged: number;
          meal_types: string[];
        }>;
      };
      get_exercise_recent_performance: {
        Args: { p_exercise_id: string; p_limit?: number };
        Returns: Array<{
          session_id: string;
          session_date: string;
          session_name: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          set_type: string;
          rpe: number | null;
          rir: number | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
