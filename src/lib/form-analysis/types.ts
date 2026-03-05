/**
 * Form Analysis types — stub for future implementation.
 * The form analysis feature will use Claude Sonnet vision
 * to analyze exercise form from 5-20 second video clips.
 */

export interface FormAnalysisResult {
  exercise_detected: string | null;
  overall_score: number;
  issues: FormIssue[];
  praise: string[];
  recommendations: string[];
}

export interface FormIssue {
  body_part: string;
  description: string;
  severity: "minor" | "moderate" | "major";
  correction: string;
}
