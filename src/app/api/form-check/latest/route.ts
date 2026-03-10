/**
 * Form Check Latest Report API
 * GET /api/form-check/latest
 *
 * Returns the user's most recent completed form analysis report summary,
 * used by the coach FAB wrapper to hydrate CoachContext.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data: report } = await supabase
      .from("form_analysis_reports")
      .select(`
        id,
        selected_exercise,
        detected_exercise,
        overall_score,
        analyzed_at,
        form_analysis_issues(description, severity)
      `)
      .eq("user_id", user.id)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!report) {
      return NextResponse.json(null);
    }

    const exercise = report.detected_exercise ?? report.selected_exercise ?? "Unknown exercise";
    const issues = Array.isArray(report.form_analysis_issues)
      ? report.form_analysis_issues
      : [];

    const topIssues = issues
      .sort((a, b) => {
        const order = { major: 0, moderate: 1, minor: 2 };
        return (order[a.severity as keyof typeof order] ?? 2) - (order[b.severity as keyof typeof order] ?? 2);
      })
      .slice(0, 3)
      .map((i) => i.description);

    return NextResponse.json({
      report_id: report.id,
      exercise,
      overall_score: report.overall_score,
      top_issues: topIssues,
      analyzed_at: report.analyzed_at,
    });
  } catch {
    return NextResponse.json(null);
  }
}
