/**
 * Active Program API
 * GET /api/programs/active
 *
 * Returns the current-day info for the user's active training program,
 * so the workout page can show an "ActiveProgramCard" without exposing
 * program templates in the personal template list.
 *
 * Response (200):
 *   {
 *     programId, programName,
 *     currentWeek, totalWeeks,
 *     currentDay, totalDaysThisWeek,
 *     dayName, templateId,
 *     exerciseNames  // first 3 exercise names from the day
 *   }
 *
 * Response (200) when no active program:
 *   { active: false }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

interface ProgramDay {
  day_number: number;
  name: string;
  template_id?: string;
  exercises?: Array<{ exercise_name?: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

interface ProgramWeek {
  week_number: number;
  days: ProgramDay[];
  [key: string]: unknown;
}

interface ProgramData {
  name: string;
  weeks: ProgramWeek[];
  [key: string]: unknown;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { data: programs, error } = await supabase
      .from("training_programs")
      .select("id, current_week, current_day, program_data")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("started_at", { ascending: false })
      .limit(1);

    if (error || !programs?.length) {
      return NextResponse.json({ active: false });
    }

    const program = programs[0];
    const programData = program.program_data as ProgramData;

    if (!programData?.weeks?.length) {
      return NextResponse.json({ active: false });
    }

    const currentWeek = program.current_week ?? 1;
    const currentDay = program.current_day ?? 1;

    const weekData = programData.weeks.find((w) => w.week_number === currentWeek);
    if (!weekData) {
      return NextResponse.json({ active: false });
    }

    const dayData = weekData.days.find((d) => d.day_number === currentDay);
    if (!dayData) {
      return NextResponse.json({ active: false });
    }

    const exerciseNames = (dayData.exercises ?? [])
      .slice(0, 3)
      .map((e) => e.exercise_name ?? "")
      .filter(Boolean);

    return NextResponse.json({
      active: true,
      programId: program.id,
      programName: programData.name,
      currentWeek,
      totalWeeks: programData.weeks.length,
      currentDay,
      totalDaysThisWeek: weekData.days.length,
      dayName: dayData.name,
      templateId: dayData.template_id ?? null,
      exerciseNames,
    });
  } catch {
    return NextResponse.json({ active: false });
  }
}
