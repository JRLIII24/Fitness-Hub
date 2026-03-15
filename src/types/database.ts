export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      accountability_pods: {
        Row: {
          arena_level: number
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          season_score: number
          season_start_date: string
          updated_at: string
        }
        Insert: {
          arena_level?: number
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          season_score?: number
          season_start_date?: string
          updated_at?: string
        }
        Update: {
          arena_level?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          season_score?: number
          season_start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accountability_pods_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      active_workout_sessions: {
        Row: {
          draft_data: Json | null
          exercise_count: number
          run_session_id: string | null
          session_name: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          draft_data?: Json | null
          exercise_count?: number
          run_session_id?: string | null
          session_name: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          draft_data?: Json | null
          exercise_count?: number
          run_session_id?: string | null
          session_name?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "active_workout_sessions_run_session_id_fkey"
            columns: ["run_session_id"]
            isOneToOne: false
            referencedRelation: "run_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "active_workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      adaptive_workout_cache: {
        Row: {
          accepted: boolean | null
          created_at: string
          generated_at: string
          generation_reason: string | null
          id: string
          user_id: string
          valid_until: string
          workout_data: Json
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          generated_at?: string
          generation_reason?: string | null
          id?: string
          user_id: string
          valid_until: string
          workout_data: Json
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          generated_at?: string
          generation_reason?: string | null
          id?: string
          user_id?: string
          valid_until?: string
          workout_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "adaptive_workout_cache_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      body_measurements: {
        Row: {
          chest_cm: number | null
          created_at: string
          hips_cm: number | null
          id: string
          left_arm_cm: number | null
          left_thigh_cm: number | null
          measured_date: string
          note: string | null
          right_arm_cm: number | null
          right_thigh_cm: number | null
          updated_at: string
          user_id: string
          waist_cm: number | null
        }
        Insert: {
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          measured_date: string
          note?: string | null
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          updated_at?: string
          user_id: string
          waist_cm?: number | null
        }
        Update: {
          chest_cm?: number | null
          created_at?: string
          hips_cm?: number | null
          id?: string
          left_arm_cm?: number | null
          left_thigh_cm?: number | null
          measured_date?: string
          note?: string | null
          right_arm_cm?: number | null
          right_thigh_cm?: number | null
          updated_at?: string
          user_id?: string
          waist_cm?: number | null
        }
        Relationships: []
      }
      body_weight_logs: {
        Row: {
          body_fat_pct: number | null
          created_at: string
          id: string
          logged_date: string
          note: string | null
          updated_at: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_date: string
          note?: string | null
          updated_at?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          body_fat_pct?: number | null
          created_at?: string
          id?: string
          logged_date?: string
          note?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      coach_memories: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_memories_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_summaries: {
        Row: {
          id: string
          user_id: string
          session_id: string
          summary: string
          key_observations: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          session_id: string
          summary: string
          key_observations?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          session_id?: string
          summary?: string
          key_observations?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_summaries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_summaries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_impressions: {
        Row: {
          acted_at: string | null
          action_type: string | null
          created_at: string
          id: string
          impression_type: string
          metadata: Json
          placement: string
          shown_at: string
          user_id: string
          variant: string | null
        }
        Insert: {
          acted_at?: string | null
          action_type?: string | null
          created_at?: string
          id?: string
          impression_type: string
          metadata?: Json
          placement: string
          shown_at?: string
          user_id: string
          variant?: string | null
        }
        Update: {
          acted_at?: string | null
          action_type?: string | null
          created_at?: string
          id?: string
          impression_type?: string
          metadata?: Json
          placement?: string
          shown_at?: string
          user_id?: string
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_impressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          category: Database["public"]["Enums"]["exercise_category_type"]
          created_at: string
          created_by: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          form_tips: string[] | null
          gif_url: string | null
          id: string
          image_url: string | null
          instructions: string | null
          is_custom: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group_type"]
          name: string
          slug: string
          source: string | null
          source_exercise_id: string | null
        }
        Insert: {
          category: Database["public"]["Enums"]["exercise_category_type"]
          created_at?: string
          created_by?: string | null
          equipment: Database["public"]["Enums"]["equipment_type"]
          form_tips?: string[] | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_custom?: boolean
          muscle_group: Database["public"]["Enums"]["muscle_group_type"]
          name: string
          slug: string
          source?: string | null
          source_exercise_id?: string | null
        }
        Update: {
          category?: Database["public"]["Enums"]["exercise_category_type"]
          created_at?: string
          created_by?: string | null
          equipment?: Database["public"]["Enums"]["equipment_type"]
          form_tips?: string[] | null
          gif_url?: string | null
          id?: string
          image_url?: string | null
          instructions?: string | null
          is_custom?: boolean
          muscle_group?: Database["public"]["Enums"]["muscle_group_type"]
          name?: string
          slug?: string
          source?: string | null
          source_exercise_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          id: string
          motivation: number
          notes: string | null
          sleep_quality: number
          soreness: number
          stress: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          id?: string
          motivation: number
          notes?: string | null
          sleep_quality: number
          soreness: number
          stress: number
          timezone: string
          updated_at?: string
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          id?: string
          motivation?: number
          notes?: string | null
          sleep_quality?: number
          soreness?: number
          stress?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_daily_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fatigue_daily_scores: {
        Row: {
          avg_load_28d: number | null
          avg_load_7d: number | null
          computed_at: string
          confidence: string
          fatigue_score: number
          id: string
          inputs: Json
          load_subscore: number
          performance_delta: number | null
          performance_subscore: number
          recommendation: string
          recovery_subscore: number
          score_date: string
          session_load_today: number | null
          strain: number | null
          timezone: string
          user_id: string
        }
        Insert: {
          avg_load_28d?: number | null
          avg_load_7d?: number | null
          computed_at?: string
          confidence: string
          fatigue_score: number
          id?: string
          inputs?: Json
          load_subscore: number
          performance_delta?: number | null
          performance_subscore: number
          recommendation: string
          recovery_subscore: number
          score_date: string
          session_load_today?: number | null
          strain?: number | null
          timezone: string
          user_id: string
        }
        Update: {
          avg_load_28d?: number | null
          avg_load_7d?: number | null
          computed_at?: string
          confidence?: string
          fatigue_score?: number
          id?: string
          inputs?: Json
          load_subscore?: number
          performance_delta?: number | null
          performance_subscore?: number
          recommendation?: string
          recovery_subscore?: number
          score_date?: string
          session_load_today?: number | null
          strain?: number | null
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fatigue_daily_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_items: {
        Row: {
          barcode: string | null
          brand: string | null
          calories_per_serving: number | null
          carbs_g: number | null
          created_at: string
          created_by: string | null
          fat_g: number | null
          fiber_g: number | null
          id: string
          name: string
          protein_g: number | null
          serving_description: string | null
          serving_size_g: number | null
          sodium_mg: number | null
          source: Database["public"]["Enums"]["food_source_type"]
          sugar_g: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          calories_per_serving?: number | null
          carbs_g?: number | null
          created_at?: string
          created_by?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          name: string
          protein_g?: number | null
          serving_description?: string | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source?: Database["public"]["Enums"]["food_source_type"]
          sugar_g?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          calories_per_serving?: number | null
          carbs_g?: number | null
          created_at?: string
          created_by?: string | null
          fat_g?: number | null
          fiber_g?: number | null
          id?: string
          name?: string
          protein_g?: number | null
          serving_description?: string | null
          serving_size_g?: number | null
          sodium_mg?: number | null
          source?: Database["public"]["Enums"]["food_source_type"]
          sugar_g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "food_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      food_log: {
        Row: {
          calories_consumed: number | null
          carbs_g: number | null
          created_at: string
          fat_g: number | null
          food_item_id: string
          id: string
          logged_at: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes: string | null
          protein_g: number | null
          servings: number
          user_id: string
        }
        Insert: {
          calories_consumed?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_item_id: string
          id?: string
          logged_at?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          protein_g?: number | null
          servings?: number
          user_id: string
        }
        Update: {
          calories_consumed?: number | null
          carbs_g?: number | null
          created_at?: string
          fat_g?: number | null
          food_item_id?: string
          id?: string
          logged_at?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          notes?: string | null
          protein_g?: number | null
          servings?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_log_food_item_id_fkey"
            columns: ["food_item_id"]
            isOneToOne: false
            referencedRelation: "food_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "food_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_analysis_issues: {
        Row: {
          body_part: string
          confidence: number | null
          correction: string
          cue: string | null
          description: string
          id: string
          issue_type: string | null
          report_id: string
          severity: string
          sort_order: number
          timestamp_seconds: number | null
          user_id: string
        }
        Insert: {
          body_part: string
          confidence?: number | null
          correction: string
          cue?: string | null
          description: string
          id?: string
          issue_type?: string | null
          report_id: string
          severity: string
          sort_order?: number
          timestamp_seconds?: number | null
          user_id: string
        }
        Update: {
          body_part?: string
          confidence?: number | null
          correction?: string
          cue?: string | null
          description?: string
          id?: string
          issue_type?: string | null
          report_id?: string
          severity?: string
          sort_order?: number
          timestamp_seconds?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_analysis_issues_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "form_analysis_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_analysis_issues_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      form_analysis_reports: {
        Row: {
          analyzed_at: string
          detected_exercise: string | null
          exercise_confidence: string | null
          id: string
          model: string
          overall_score: number | null
          praise: string[]
          raw_response: Json
          recommendations: string[]
          safety_notes: string[]
          selected_exercise: string | null
          summary: string
          user_id: string
          video_id: string
        }
        Insert: {
          analyzed_at?: string
          detected_exercise?: string | null
          exercise_confidence?: string | null
          id?: string
          model: string
          overall_score?: number | null
          praise?: string[]
          raw_response?: Json
          recommendations?: string[]
          safety_notes?: string[]
          selected_exercise?: string | null
          summary: string
          user_id: string
          video_id: string
        }
        Update: {
          analyzed_at?: string
          detected_exercise?: string | null
          exercise_confidence?: string | null
          id?: string
          model?: string
          overall_score?: number | null
          praise?: string[]
          raw_response?: Json
          recommendations?: string[]
          safety_notes?: string[]
          selected_exercise?: string | null
          summary?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_analysis_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_analysis_reports_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: true
            referencedRelation: "form_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      form_videos: {
        Row: {
          analysis_error: string | null
          analysis_status: string
          duration_seconds: number | null
          expires_at: string
          id: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_at: string
          user_id: string
          workout_session_id: string | null
        }
        Insert: {
          analysis_error?: string | null
          analysis_status?: string
          duration_seconds?: number | null
          expires_at?: string
          id?: string
          mime_type: string
          original_filename: string
          size_bytes: number
          storage_path: string
          uploaded_at?: string
          user_id: string
          workout_session_id?: string | null
        }
        Update: {
          analysis_error?: string | null
          analysis_status?: string
          duration_seconds?: number | null
          expires_at?: string
          id?: string
          mime_type?: string
          original_filename?: string
          size_bytes?: number
          storage_path?: string
          uploaded_at?: string
          user_id?: string
          workout_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_videos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_videos_workout_session_id_fkey"
            columns: ["workout_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      grocery_lists: {
        Row: {
          ai_summary: string | null
          created_at: string
          id: string
          items: Json
          title: string
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          ai_summary?: string | null
          created_at?: string
          id?: string
          items?: Json
          title?: string
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          ai_summary?: string | null
          created_at?: string
          id?: string
          items?: Json
          title?: string
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      health_sync_data: {
        Row: {
          created_at: string
          hrv_ms: number | null
          id: string
          resting_heart_rate: number | null
          sleep_hours: number | null
          source: string
          steps: number | null
          sync_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hrv_ms?: number | null
          id?: string
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          source: string
          steps?: number | null
          sync_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hrv_ms?: number | null
          id?: string
          resting_heart_rate?: number | null
          sleep_hours?: number | null
          source?: string
          steps?: number | null
          sync_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      meal_templates: {
        Row: {
          created_at: string
          id: string
          items: Json
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          items?: Json
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          items?: Json
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          id: string
          pod_pings_enabled: boolean
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          streak_alerts_enabled: boolean
          updated_at: string
          user_id: string
          workout_reminders_enabled: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          pod_pings_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          streak_alerts_enabled?: boolean
          updated_at?: string
          user_id: string
          workout_reminders_enabled?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          pod_pings_enabled?: boolean
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          streak_alerts_enabled?: boolean
          updated_at?: string
          user_id?: string
          workout_reminders_enabled?: boolean
        }
        Relationships: []
      }
      nutrition_goals: {
        Row: {
          calories_target: number | null
          carbs_g_target: number | null
          created_at: string
          effective_from: string
          fat_g_target: number | null
          fiber_g_target: number | null
          id: string
          protein_g_target: number | null
          user_id: string
        }
        Insert: {
          calories_target?: number | null
          carbs_g_target?: number | null
          created_at?: string
          effective_from?: string
          fat_g_target?: number | null
          fiber_g_target?: number | null
          id?: string
          protein_g_target?: number | null
          user_id: string
        }
        Update: {
          calories_target?: number | null
          carbs_g_target?: number | null
          created_at?: string
          effective_from?: string
          fat_g_target?: number | null
          fiber_g_target?: number | null
          id?: string
          protein_g_target?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutrition_goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pings: {
        Row: {
          created_at: string
          id: string
          message: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pings_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pings_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_challenges: {
        Row: {
          challenge_type: string
          created_at: string
          created_by: string
          end_date: string
          id: string
          name: string
          pod_id: string
          start_date: string
          target_value: number | null
        }
        Insert: {
          challenge_type: string
          created_at?: string
          created_by: string
          end_date: string
          id?: string
          name: string
          pod_id: string
          start_date: string
          target_value?: number | null
        }
        Update: {
          challenge_type?: string
          created_at?: string
          created_by?: string
          end_date?: string
          id?: string
          name?: string
          pod_id?: string
          start_date?: string
          target_value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pod_challenges_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_challenges_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_commitments: {
        Row: {
          created_at: string
          id: string
          planned_days: string[]
          pod_id: string
          user_id: string
          week_start_date: string
          workouts_per_week: number
        }
        Insert: {
          created_at?: string
          id?: string
          planned_days?: string[]
          pod_id: string
          user_id: string
          week_start_date: string
          workouts_per_week: number
        }
        Update: {
          created_at?: string
          id?: string
          planned_days?: string[]
          pod_id?: string
          user_id?: string
          week_start_date?: string
          workouts_per_week?: number
        }
        Relationships: [
          {
            foreignKeyName: "pod_commitments_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_commitments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_invites: {
        Row: {
          created_at: string
          id: string
          invitee_id: string
          inviter_id: string
          pod_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          invitee_id: string
          inviter_id: string
          pod_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          invitee_id?: string
          inviter_id?: string
          pod_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_invites_invitee_id_fkey"
            columns: ["invitee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_invites_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_invites_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_members: {
        Row: {
          id: string
          joined_at: string
          pod_id: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          pod_id: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          pod_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          pod_id: string
          recipient_id: string | null
          sender_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          pod_id: string
          recipient_id?: string | null
          sender_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          pod_id?: string
          recipient_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_messages_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pod_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_season_recaps: {
        Row: {
          id: string
          pod_id: string
          recap_date: string
          summary: string
          mvp_user_id: string | null
          highlights: Json
          stats: Json
          created_at: string
        }
        Insert: {
          id?: string
          pod_id: string
          recap_date: string
          summary: string
          mvp_user_id?: string | null
          highlights?: Json
          stats?: Json
          created_at?: string
        }
        Update: {
          id?: string
          pod_id?: string
          recap_date?: string
          summary?: string
          mvp_user_id?: string | null
          highlights?: Json
          stats?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_season_recaps_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "accountability_pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pro_waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string | null
          activity_level: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_streak: number
          current_weight_kg: number | null
          date_of_birth: string | null
          display_name: string | null
          equipment_available: string[] | null
          experience_level: string | null
          feature_flags: Json | null
          fitness_goal: Database["public"]["Enums"]["fitness_goal_type"] | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          goal_weight_kg: number | null
          height_cm: number | null
          id: string
          is_public: boolean
          last_freeze_reset_at: string | null
          last_launcher_used_at: string | null
          last_level_up_at: string | null
          last_seen_at: string | null
          level: number
          onboarding_completed: boolean
          preferred_workout_days: number[] | null
          preferred_workout_days_set_at: string | null
          show_weight: boolean
          spotify_access_token: string | null
          spotify_connected_at: string | null
          spotify_refresh_token: string | null
          spotify_token_expires_at: string | null
          spotify_user_id: string | null
          streak_freeze_available: boolean
          streak_milestones_unlocked: number[] | null
          theme_preference: string
          timezone: string | null
          typical_session_duration_mins: number | null
          unit_preference: string | null
          updated_at: string
          username: string | null
          weight_kg: number | null
          xp: number
        }
        Insert: {
          accent_color?: string | null
          activity_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          current_weight_kg?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          equipment_available?: string[] | null
          experience_level?: string | null
          feature_flags?: Json | null
          fitness_goal?: Database["public"]["Enums"]["fitness_goal_type"] | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id: string
          is_public?: boolean
          last_freeze_reset_at?: string | null
          last_launcher_used_at?: string | null
          last_level_up_at?: string | null
          last_seen_at?: string | null
          level?: number
          onboarding_completed?: boolean
          preferred_workout_days?: number[] | null
          preferred_workout_days_set_at?: string | null
          show_weight?: boolean
          spotify_access_token?: string | null
          spotify_connected_at?: string | null
          spotify_refresh_token?: string | null
          spotify_token_expires_at?: string | null
          spotify_user_id?: string | null
          streak_freeze_available?: boolean
          streak_milestones_unlocked?: number[] | null
          theme_preference?: string
          timezone?: string | null
          typical_session_duration_mins?: number | null
          unit_preference?: string | null
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
          xp?: number
        }
        Update: {
          accent_color?: string | null
          activity_level?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_streak?: number
          current_weight_kg?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          equipment_available?: string[] | null
          experience_level?: string | null
          feature_flags?: Json | null
          fitness_goal?: Database["public"]["Enums"]["fitness_goal_type"] | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          goal_weight_kg?: number | null
          height_cm?: number | null
          id?: string
          is_public?: boolean
          last_freeze_reset_at?: string | null
          last_launcher_used_at?: string | null
          last_level_up_at?: string | null
          last_seen_at?: string | null
          level?: number
          onboarding_completed?: boolean
          preferred_workout_days?: number[] | null
          preferred_workout_days_set_at?: string | null
          show_weight?: boolean
          spotify_access_token?: string | null
          spotify_connected_at?: string | null
          spotify_refresh_token?: string | null
          spotify_token_expires_at?: string | null
          spotify_user_id?: string | null
          streak_freeze_available?: boolean
          streak_milestones_unlocked?: number[] | null
          theme_preference?: string
          timezone?: string | null
          typical_session_duration_mins?: number | null
          unit_preference?: string | null
          updated_at?: string
          username?: string | null
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      push_device_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      readiness_daily_scores: {
        Row: {
          computed_at: string
          confidence: string
          external_score: number | null
          id: string
          nutrition_score: number | null
          readiness_score: number
          recommendation: string
          recovery_score: number | null
          score_date: string
          training_score: number | null
          user_id: string
        }
        Insert: {
          computed_at?: string
          confidence: string
          external_score?: number | null
          id?: string
          nutrition_score?: number | null
          readiness_score: number
          recommendation: string
          recovery_score?: number | null
          score_date: string
          training_score?: number | null
          user_id: string
        }
        Update: {
          computed_at?: string
          confidence?: string
          external_score?: number | null
          id?: string
          nutrition_score?: number | null
          readiness_score?: number
          recommendation?: string
          recovery_score?: number | null
          score_date?: string
          training_score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      relapse_interventions: {
        Row: {
          accepted_at: string | null
          comeback_plan_data: Json | null
          created_at: string
          days_inactive: number
          detected_at: string
          dismissed_at: string | null
          id: string
          intervention_type: string
          severity: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          comeback_plan_data?: Json | null
          created_at?: string
          days_inactive: number
          detected_at?: string
          dismissed_at?: string | null
          id?: string
          intervention_type: string
          severity: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          comeback_plan_data?: Json | null
          created_at?: string
          days_inactive?: number
          detected_at?: string
          dismissed_at?: string | null
          id?: string
          intervention_type?: string
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "relapse_interventions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_events: {
        Row: {
          created_at: string
          event_timestamp: string
          event_type: string
          id: string
          metadata: Json
          source_screen: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_timestamp?: string
          event_type: string
          id?: string
          metadata?: Json
          source_screen?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_timestamp?: string
          event_type?: string
          id?: string
          metadata?: Json
          source_screen?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retention_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_metrics: {
        Row: {
          combined_load: number | null
          computed_at: string
          estimated_vo2max: number | null
          id: string
          lift_load_this_week: number | null
          run_load_this_week: number | null
          total_distance_meters: number
          total_duration_seconds: number
          total_runs: number
          user_id: string
          week_start_date: string
        }
        Insert: {
          combined_load?: number | null
          computed_at?: string
          estimated_vo2max?: number | null
          id?: string
          lift_load_this_week?: number | null
          run_load_this_week?: number | null
          total_distance_meters?: number
          total_duration_seconds?: number
          total_runs?: number
          user_id: string
          week_start_date: string
        }
        Update: {
          combined_load?: number | null
          computed_at?: string
          estimated_vo2max?: number | null
          id?: string
          lift_load_this_week?: number | null
          run_load_this_week?: number | null
          total_distance_meters?: number
          total_duration_seconds?: number
          total_runs?: number
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "run_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_sessions: {
        Row: {
          avg_cadence_spm: number | null
          avg_pace_sec_per_km: number | null
          best_pace_sec_per_km: number | null
          completed_at: string | null
          created_at: string
          distance_meters: number | null
          duration_seconds: number | null
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          estimated_calories: number | null
          estimated_vo2max: number | null
          id: string
          is_treadmill: boolean
          map_bbox: Json | null
          moving_duration_seconds: number | null
          name: string
          notes: string | null
          primary_zone: Database["public"]["Enums"]["run_intensity_zone"] | null
          route_polyline: string | null
          session_load: number | null
          session_rpe: number | null
          started_at: string
          status: Database["public"]["Enums"]["run_status"]
          tag: Database["public"]["Enums"]["run_tag"] | null
          user_id: string
          zone_breakdown: Json
        }
        Insert: {
          avg_cadence_spm?: number | null
          avg_pace_sec_per_km?: number | null
          best_pace_sec_per_km?: number | null
          completed_at?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          estimated_calories?: number | null
          estimated_vo2max?: number | null
          id?: string
          is_treadmill?: boolean
          map_bbox?: Json | null
          moving_duration_seconds?: number | null
          name: string
          notes?: string | null
          primary_zone?:
            | Database["public"]["Enums"]["run_intensity_zone"]
            | null
          route_polyline?: string | null
          session_load?: number | null
          session_rpe?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          tag?: Database["public"]["Enums"]["run_tag"] | null
          user_id: string
          zone_breakdown?: Json
        }
        Update: {
          avg_cadence_spm?: number | null
          avg_pace_sec_per_km?: number | null
          best_pace_sec_per_km?: number | null
          completed_at?: string | null
          created_at?: string
          distance_meters?: number | null
          duration_seconds?: number | null
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          estimated_calories?: number | null
          estimated_vo2max?: number | null
          id?: string
          is_treadmill?: boolean
          map_bbox?: Json | null
          moving_duration_seconds?: number | null
          name?: string
          notes?: string | null
          primary_zone?:
            | Database["public"]["Enums"]["run_intensity_zone"]
            | null
          route_polyline?: string | null
          session_load?: number | null
          session_rpe?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["run_status"]
          tag?: Database["public"]["Enums"]["run_tag"] | null
          user_id?: string
          zone_breakdown?: Json
        }
        Relationships: [
          {
            foreignKeyName: "run_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      run_splits: {
        Row: {
          completed_at: string
          duration_seconds: number
          elevation_gain_m: number | null
          elevation_loss_m: number | null
          id: string
          lat: number | null
          lng: number | null
          pace_sec_per_km: number
          run_session_id: string
          split_distance_meters: number
          split_number: number
          started_at: string
          user_id: string
          zone: Database["public"]["Enums"]["run_intensity_zone"] | null
        }
        Insert: {
          completed_at: string
          duration_seconds: number
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          pace_sec_per_km: number
          run_session_id: string
          split_distance_meters: number
          split_number: number
          started_at: string
          user_id: string
          zone?: Database["public"]["Enums"]["run_intensity_zone"] | null
        }
        Update: {
          completed_at?: string
          duration_seconds?: number
          elevation_gain_m?: number | null
          elevation_loss_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          pace_sec_per_km?: number
          run_session_id?: string
          split_distance_meters?: number
          split_number?: number
          started_at?: string
          user_id?: string
          zone?: Database["public"]["Enums"]["run_intensity_zone"] | null
        }
        Relationships: [
          {
            foreignKeyName: "run_splits_run_session_id_fkey"
            columns: ["run_session_id"]
            isOneToOne: false
            referencedRelation: "run_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "run_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_items: {
        Row: {
          created_at: string
          id: string
          item_snapshot: Json
          item_type: string
          message: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          template_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_snapshot: Json
          item_type: string
          message?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          template_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_snapshot?: Json
          item_type?: string
          message?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shared_items_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_items_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shared_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      streak_risk_alerts: {
        Row: {
          alert_date: string
          created_at: string
          id: string
          notified_pod_member_ids: string[]
          risk_level: string
          streak_count: number
          user_id: string
        }
        Insert: {
          alert_date: string
          created_at?: string
          id?: string
          notified_pod_member_ids?: string[]
          risk_level: string
          streak_count: number
          user_id: string
        }
        Update: {
          alert_date?: string
          created_at?: string
          id?: string
          notified_pod_member_ids?: string[]
          risk_level?: string
          streak_count?: number
          user_id?: string
        }
        Relationships: []
      }
      template_exercise_sets: {
        Row: {
          created_at: string
          duration_seconds: number | null
          id: string
          reps: number | null
          rest_seconds: number | null
          set_number: number
          set_type: Database["public"]["Enums"]["set_type"]
          template_exercise_id: string
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          reps?: number | null
          rest_seconds?: number | null
          set_number: number
          set_type?: Database["public"]["Enums"]["set_type"]
          template_exercise_id: string
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          id?: string
          reps?: number | null
          rest_seconds?: number | null
          set_number?: number
          set_type?: Database["public"]["Enums"]["set_type"]
          template_exercise_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "template_exercise_sets_template_exercise_id_fkey"
            columns: ["template_exercise_id"]
            isOneToOne: false
            referencedRelation: "template_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      template_exercises: {
        Row: {
          exercise_id: string
          id: string
          notes: string | null
          rest_seconds: number | null
          sort_order: number
          target_reps: string | null
          target_sets: number | null
          target_weight_kg: number | null
          template_id: string
        }
        Insert: {
          exercise_id: string
          id?: string
          notes?: string | null
          rest_seconds?: number | null
          sort_order?: number
          target_reps?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          template_id: string
        }
        Update: {
          exercise_id?: string
          id?: string
          notes?: string | null
          rest_seconds?: number | null
          sort_order?: number
          target_reps?: string | null
          target_sets?: number | null
          target_weight_kg?: number | null
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_favorites: {
        Row: {
          created_at: string
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_favorites_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      template_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number
          reviewer_id: string
          template_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating: number
          reviewer_id: string
          template_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number
          reviewer_id?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_reviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_saves: {
        Row: {
          id: string
          saved_at: string
          template_id: string
          user_id: string
        }
        Insert: {
          id?: string
          saved_at?: string
          template_id: string
          user_id: string
        }
        Update: {
          id?: string
          saved_at?: string
          template_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_saves_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_saves_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          completed_at: string | null
          created_at: string
          current_day: number | null
          current_week: number | null
          days_per_week: number
          description: string | null
          goal: string
          id: string
          name: string
          program_data: Json
          started_at: string | null
          status: string
          user_id: string
          weeks: number
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_day?: number | null
          current_week?: number | null
          days_per_week: number
          description?: string | null
          goal: string
          id?: string
          name: string
          program_data: Json
          started_at?: string | null
          status?: string
          user_id: string
          weeks: number
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_day?: number | null
          current_week?: number | null
          days_per_week?: number
          description?: string | null
          goal?: string
          id?: string
          name?: string
          program_data?: Json
          started_at?: string | null
          status?: string
          user_id?: string
          weeks?: number
        }
        Relationships: []
      }
      user_exercise_last_performance: {
        Row: {
          best_set: Json
          exercise_id: string
          last_performed_at: string
          last_session_id: string
          total_sets: number
          updated_at: string
          user_id: string
        }
        Insert: {
          best_set: Json
          exercise_id: string
          last_performed_at: string
          last_session_id: string
          total_sets?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          best_set?: Json
          exercise_id?: string
          last_performed_at?: string
          last_session_id?: string
          total_sets?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_exercise_last_performance_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_last_performance_last_session_id_fkey"
            columns: ["last_session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_exercise_last_performance_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_intents: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          intent_for_date: string | null
          intent_payload: Json
          intent_type: string
          source_screen: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          intent_for_date?: string | null
          intent_payload?: Json
          intent_type: string
          source_screen?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          intent_for_date?: string | null
          intent_payload?: Json
          intent_type?: string
          source_screen?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_intents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_events: {
        Row: {
          created_at: string
          event_data: Json
          event_timestamp: string
          event_type: string
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_data?: Json
          event_timestamp?: string
          event_type: string
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_data?: Json
          event_timestamp?: string
          event_type?: string
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          duration_seconds: number | null
          id: string
          name: string
          notes: string | null
          session_rpe: number | null
          started_at: string
          status: Database["public"]["Enums"]["session_status_type"]
          template_id: string | null
          total_volume_kg: number | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name: string
          notes?: string | null
          session_rpe?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status_type"]
          template_id?: string | null
          total_volume_kg?: number | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          duration_seconds?: number | null
          id?: string
          name?: string
          notes?: string | null
          session_rpe?: number | null
          started_at?: string
          status?: Database["public"]["Enums"]["session_status_type"]
          template_id?: string | null
          total_volume_kg?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sets: {
        Row: {
          completed_at: string | null
          duration_seconds: number | null
          exercise_id: string
          id: string
          notes: string | null
          reps: number | null
          rest_seconds: number | null
          rir: number | null
          rpe: number | null
          session_id: string
          set_number: number
          set_type: Database["public"]["Enums"]["set_type"]
          sort_order: number
          weight_kg: number | null
        }
        Insert: {
          completed_at?: string | null
          duration_seconds?: number | null
          exercise_id: string
          id?: string
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          session_id: string
          set_number: number
          set_type?: Database["public"]["Enums"]["set_type"]
          sort_order?: number
          weight_kg?: number | null
        }
        Update: {
          completed_at?: string | null
          duration_seconds?: number | null
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: number | null
          rest_seconds?: number | null
          rir?: number | null
          rpe?: number | null
          session_id?: string
          set_number?: number
          set_type?: Database["public"]["Enums"]["set_type"]
          sort_order?: number
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sets_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_sets_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_templates: {
        Row: {
          auto_generate_soundtrack: boolean | null
          avg_rating: number | null
          color: string | null
          created_at: string
          description: string | null
          estimated_duration_min: number | null
          id: string
          is_public: boolean
          is_shared: boolean
          name: string
          primary_muscle_group: string | null
          program_id: string | null
          review_count: number
          save_count: number
          training_block: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_generate_soundtrack?: boolean | null
          avg_rating?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_duration_min?: number | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          name: string
          primary_muscle_group?: string | null
          program_id?: string | null
          review_count?: number
          save_count?: number
          training_block?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_generate_soundtrack?: boolean | null
          avg_rating?: number | null
          color?: string | null
          created_at?: string
          description?: string | null
          estimated_duration_min?: number | null
          id?: string
          is_public?: boolean
          is_shared?: boolean
          name?: string
          primary_muscle_group?: string | null
          program_id?: string | null
          review_count?: number
          save_count?: number
          training_block?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_templates_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      template_last_performed: {
        Row: {
          last_performed_at: string | null
          template_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_rating_stats: {
        Row: {
          avg_rating: number | null
          review_count: number | null
          template_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "template_reviews_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "workout_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_xp: {
        Args: { user_id_param: string; xp_amount: number }
        Returns: {
          leveled_up: boolean
          new_level: number
          new_xp: number
        }[]
      }
      check_streak_milestones: {
        Args: { user_id_param: string }
        Returns: number[]
      }
      cleanup_stale_workouts: { Args: never; Returns: undefined }
      delete_expired_form_videos: {
        Args: { batch_size?: number }
        Returns: {
          deleted_count: number
          storage_paths: string[]
        }[]
      }
      detect_streak_risk_users: {
        Args: never
        Returns: {
          current_streak: number
          display_name: string
          hours_since_last_workout: number
          pod_ids: string[]
          risk_level: string
          user_id: string
        }[]
      }
      ensure_user_profile: { Args: { user_id: string }; Returns: undefined }
      get_dashboard_nutrition_summary: {
        Args: { p_date_str: string; p_user_id: string }
        Returns: {
          total_calories: number
          total_carbs_g: number
          total_fat_g: number
          total_fiber_g: number
          total_protein_g: number
          total_servings: number
          total_sodium_mg: number
          total_sugar_g: number
        }[]
      }
      get_dashboard_workout_summary: {
        Args: { p_days_back?: number; p_user_id: string }
        Returns: {
          avg_volume_28d: number
          latest_duration: number
          latest_id: string
          latest_name: string
          latest_started_at: string
          latest_volume_kg: number
          sessions_28d: number
          sessions_7d: number
          total_sessions: number
        }[]
      }
      get_exercise_recent_performance: {
        Args: { p_exercise_id: string; p_limit?: number }
        Returns: {
          reps: number
          rir: number
          rpe: number
          session_date: string
          session_id: string
          session_name: string
          set_number: number
          set_type: string
          weight_kg: number
        }[]
      }
      get_exercise_trendlines: {
        Args: { p_exercise_ids: string[]; p_user_id: string }
        Returns: {
          exercise_id: string
          session_rank: number
          top_set_weight_kg: number
        }[]
      }
      get_food_log_summary_for_grocery: {
        Args: { p_days_back?: number }
        Returns: {
          avg_daily_servings: number
          food_name: string
          meal_types: string[]
          serving_description: string
          serving_size_g: number
          times_logged: number
          total_servings: number
        }[]
      }
      get_history_stats: { Args: { p_user_id: string }; Returns: Json }
      get_muscle_group_recovery: {
        Args: { p_lookback_days?: number; p_user_id: string }
        Returns: {
          avg_rpe: number
          hours_since_trained: number
          last_trained_at: string
          muscle_group: string
          total_sets: number
          total_volume_kg: number
        }[]
      }
      get_nutrition_compliance: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          avg_calorie_pct: number
          avg_protein_pct: number
          days_tracked: number
        }[]
      }
      get_pod_challenge_leaderboard: {
        Args: { p_challenge_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          rank: number
          runs_cnt: number
          score: number
          user_id: string
          workouts_cnt: number
        }[]
      }
      get_week_start: { Args: { input_date?: string }; Returns: string }
      get_week_start_date: { Args: never; Returns: string }
      import_public_template: {
        Args: { p_template_id: string }
        Returns: string
      }
      reset_monthly_streak_freeze: { Args: never; Returns: undefined }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      use_streak_freeze: { Args: { user_id_param: string }; Returns: boolean }
      user_is_pod_member: {
        Args: { p_pod_id: string; p_user_id: string }
        Returns: boolean
      }
      users_share_pod: {
        Args: { user1_id: string; user2_id: string }
        Returns: boolean
      }
    }
    Enums: {
      equipment_type:
        | "barbell"
        | "dumbbell"
        | "cable"
        | "machine"
        | "bodyweight"
        | "band"
      exercise_category_type: "compound" | "isolation" | "cardio" | "stretch"
      fitness_goal_type:
        | "lose_weight"
        | "build_muscle"
        | "maintain"
        | "improve_endurance"
        | "bulk"
        | "cut"
      food_source_type: "openfoodfacts" | "usda" | "manual" | "ai-scan"
      gender_type: "male" | "female" | "other" | "prefer_not_to_say"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      muscle_group_type:
        | "chest"
        | "back"
        | "legs"
        | "shoulders"
        | "arms"
        | "core"
        | "full_body"
      run_intensity_zone:
        | "zone1_active_recovery"
        | "zone2_aerobic"
        | "zone3_tempo"
        | "zone4_threshold"
        | "zone5_anaerobic"
      run_status: "in_progress" | "paused" | "completed" | "cancelled"
      run_tag:
        | "recovery"
        | "conditioning"
        | "hiit"
        | "speed_work"
        | "game_prep"
        | "long_run"
        | "tempo"
        | "easy"
      session_status_type: "in_progress" | "completed" | "cancelled"
      set_type: "warmup" | "working" | "dropset" | "failure"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      equipment_type: [
        "barbell",
        "dumbbell",
        "cable",
        "machine",
        "bodyweight",
        "band",
      ],
      exercise_category_type: ["compound", "isolation", "cardio", "stretch"],
      fitness_goal_type: [
        "lose_weight",
        "build_muscle",
        "maintain",
        "improve_endurance",
      ],
      food_source_type: ["openfoodfacts", "usda", "manual", "ai-scan"],
      gender_type: ["male", "female", "other", "prefer_not_to_say"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      muscle_group_type: [
        "chest",
        "back",
        "legs",
        "shoulders",
        "arms",
        "core",
        "full_body",
      ],
      run_intensity_zone: [
        "zone1_active_recovery",
        "zone2_aerobic",
        "zone3_tempo",
        "zone4_threshold",
        "zone5_anaerobic",
      ],
      run_status: ["in_progress", "paused", "completed", "cancelled"],
      run_tag: [
        "recovery",
        "conditioning",
        "hiit",
        "speed_work",
        "game_prep",
        "long_run",
        "tempo",
        "easy",
      ],
      session_status_type: ["in_progress", "completed", "cancelled"],
      set_type: ["warmup", "working", "dropset", "failure"],
    },
  },
} as const
