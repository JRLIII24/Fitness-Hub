/**
 * Program Auto-Advance API
 * POST /api/programs/advance
 *
 * Called after a workout completes. If the workout's template_id belongs
 * to an active training program, advance current_day (and current_week
 * when a week is finished). Mark program completed when all weeks are done.
 *
 * Body: { template_id: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

interface ProgramDay {
  day_number: number;
  template_id?: string;
  [key: string]: unknown;
}

interface ProgramWeek {
  week_number: number;
  days: ProgramDay[];
  [key: string]: unknown;
}

interface ProgramData {
  weeks: ProgramWeek[];
  [key: string]: unknown;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { template_id } = await request.json();
    if (!template_id) {
      return NextResponse.json({ advanced: false });
    }

    // Find an active program that contains this template_id in its program_data
    const { data: programs } = await supabase
      .from("training_programs")
      .select("id, current_week, current_day, program_data")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (!programs?.length) {
      return NextResponse.json({ advanced: false });
    }

    // Search each active program for a day matching this template_id
    for (const program of programs) {
      const programData = program.program_data as ProgramData;
      if (!programData?.weeks?.length) continue;

      // Find which week/day this template belongs to
      let matchedWeek: number | null = null;
      let matchedDay: number | null = null;

      for (const week of programData.weeks) {
        for (const day of week.days) {
          if (day.template_id === template_id) {
            matchedWeek = week.week_number;
            matchedDay = day.day_number;
            break;
          }
        }
        if (matchedWeek !== null) break;
      }

      if (matchedWeek === null || matchedDay === null) continue;

      // Found the program. Now compute the next position.
      const currentWeekData = programData.weeks.find(
        (w) => w.week_number === program.current_week
      );
      const daysInCurrentWeek = currentWeekData?.days?.length ?? 0;
      const totalWeeks = programData.weeks.length;

      let nextWeek = program.current_week ?? 1;
      let nextDay = (program.current_day ?? 1) + 1;

      if (nextDay > daysInCurrentWeek) {
        // Finished this week, move to next
        nextWeek = (program.current_week ?? 1) + 1;
        nextDay = 1;
      }

      if (nextWeek > totalWeeks) {
        // Program complete
        await supabase
          .from("training_programs")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            current_week: totalWeeks,
            current_day: daysInCurrentWeek,
          })
          .eq("id", program.id)
          .eq("user_id", user.id);

        return NextResponse.json({ advanced: true, completed: true });
      }

      // Advance to next day/week
      await supabase
        .from("training_programs")
        .update({
          current_week: nextWeek,
          current_day: nextDay,
        })
        .eq("id", program.id)
        .eq("user_id", user.id);

      return NextResponse.json({
        advanced: true,
        current_week: nextWeek,
        current_day: nextDay,
      });
    }

    // No active program matched this template
    return NextResponse.json({ advanced: false });
  } catch {
    return NextResponse.json({ advanced: false });
  }
}
