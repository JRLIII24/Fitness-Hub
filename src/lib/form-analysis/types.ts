/**
 * Form Analysis types — full types for the AI form coach feature.
 * Used by the form-check API, UI components, and coach integration.
 */

export type AnalysisStatus = "pending" | "processing" | "completed" | "failed";
export type IssueSeverity = "minor" | "moderate" | "major";
export type ExerciseConfidence = "low" | "medium" | "high";

export interface FormVideo {
  id: string;
  user_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  duration_seconds: number | null;
  uploaded_at: string;
  expires_at: string;
  analysis_status: AnalysisStatus;
  analysis_error: string | null;
}

export interface FormAnalysisReport {
  id: string;
  video_id: string;
  user_id: string;
  selected_exercise: string | null;
  detected_exercise: string | null;
  exercise_confidence: ExerciseConfidence | null;
  overall_score: number;
  summary: string;
  praise: string[];
  recommendations: string[];
  safety_notes: string[];
  model: string;
  analyzed_at: string;
}

export interface FormAnalysisIssue {
  id: string;
  report_id: string;
  sort_order: number;
  body_part: string;
  issue_type: string | null;
  severity: IssueSeverity;
  timestamp_seconds: number | null;
  description: string;
  correction: string;
  cue: string | null;
  confidence: number | null;
}

export interface FormAnalysisResult {
  exercise_detected: string | null;
  exercise_confidence: ExerciseConfidence;
  overall_score: number;
  summary: string;
  issues: Array<{
    body_part: string;
    issue_type?: string;
    severity: IssueSeverity;
    timestamp_seconds?: number;
    description: string;
    correction: string;
    cue?: string;
    confidence?: number;
  }>;
  praise: string[];
  recommendations: string[];
  safety_notes: string[];
}

/** Summary shape sent to coach context */
export interface FormReportSummary {
  report_id: string;
  exercise: string;
  overall_score: number;
  top_issues: string[];
  analyzed_at: string;
}

/** Shape for history list items */
export interface FormHistoryItem {
  id: string;
  video_id: string;
  selected_exercise: string | null;
  detected_exercise: string | null;
  overall_score: number;
  summary: string;
  analyzed_at: string;
  video_uploaded_at: string;
  video_expires_at: string;
  video_storage_path: string;
  praise: string[];
  recommendations: string[];
  safety_notes: string[];
  exercise_confidence: ExerciseConfidence | null;
}

/** Frame extracted client-side for analysis */
export interface ExtractedFrame {
  timestampSeconds: number;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
}
