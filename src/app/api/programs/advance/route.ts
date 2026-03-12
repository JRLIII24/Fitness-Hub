/**
 * Program Auto-Advance API
 * POST /api/programs/advance
 *
 * Called after a workout completes. Uses the template's program_id FK
 * (set at creation time) to locate the active program directly — no
 * full JSONB scan needed.
 *
 * After advancing current_day/current_week, creates a template for the
 * NEW current day so the ActiveProgramCard immediately shows the next
 * session. This is the "lazy, one-at-a-time" template creation strategy.
 *
 * Body: { template_id: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { createTemplateFromProgramDay, type ProgramDayData } from "@/lib/program-service";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";

interface ProgramDay {
  day_number: number;
  name: string;
  template_id?: string;
  exercises?: unknown[];
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

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const { template_id } = await request.json();
    if (!template_id) {
      return NextResponse.json({ advanced: false });
    }

    // Use the program_id FK on the template to find the program directly.
    const { data: templateRow } = await supabase
      .from("workout_templates")
      .select("program_id")
      .eq("id", template_id)
      .eq("user_id", user.id)
      .single();

    if (!templateRow?.program_id) {
      // Not a program template — nothing to advance
      return NextResponse.json({ advanced: false });
    }

    const programId = templateRow.program_id;

    const { data: program } = await supabase
      .from("training_programs")
      .select("id, current_week, current_day, program_data")
      .eq("id", programId)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!program) {
      return NextResponse.json({ advanced: false });
    }

    const programData = program.program_data as ProgramData;
    if (!programData?.weeks?.length) {
      return NextResponse.json({ advanced: false });
    }

    const currentWeek = program.current_week ?? 1;
    const currentDay = program.current_day ?? 1;
    const totalWeeks = programData.weeks.length;

    const currentWeekData = programData.weeks.find((w) => w.week_number === currentWeek);
    const daysInCurrentWeek = currentWeekData?.days?.length ?? 0;

    // Compute next position
    let nextWeek = currentWeek;
    let nextDay = currentDay + 1;

    if (nextDay > daysInCurrentWeek) {
      nextWeek = currentWeek + 1;
      nextDay = 1;
    }

    // Program complete
    if (nextWeek > totalWeeks) {
      await supabase
        .from("training_programs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_week: totalWeeks,
          current_day: daysInCurrentWeek,
        })
        .eq("id", programId)
        .eq("user_id", user.id);

      return NextResponse.json({ advanced: true, completed: true });
    }

    // Create a template for the next day on-demand
    const nextWeekData = programData.weeks.find((w) => w.week_number === nextWeek);
    const nextDayData = nextWeekData?.days?.find((d) => d.day_number === nextDay);

    let nextTemplateId: string | null = null;
    let updatedWeeks = programData.weeks;

    if (nextDayData) {
      nextTemplateId = await createTemplateFromProgramDay(
        supabase,
        user.id,
        programData.name,
        nextWeek,
        nextDayData as ProgramDayData,
        programId,
      );

      if (nextTemplateId) {
        // Store the new template_id in program_data for the next day
        updatedWeeks = programData.weeks.map((week) => ({
          ...week,
          days: week.days.map((day) => {
            if (week.week_number === nextWeek && day.day_number === nextDay) {
              return { ...day, template_id: nextTemplateId } as ProgramDay;
            }
            return day;
          }),
        }));
      }
    } else {
      logger.error(`Advance: no day data found for W${nextWeek}D${nextDay} in program ${programId}`);
    }

    // Advance the program position and persist the updated program_data
    const { error: updateErr } = await supabase
      .from("training_programs")
      .update({
        current_week: nextWeek,
        current_day: nextDay,
        program_data: { ...programData, weeks: updatedWeeks } as unknown as Json,
      })
      .eq("id", programId)
      .eq("user_id", user.id);

    if (updateErr) {
      logger.error("Failed to advance program:", updateErr);
      return NextResponse.json({ advanced: false });
    }

    return NextResponse.json({
      advanced: true,
      current_week: nextWeek,
      current_day: nextDay,
      next_template_id: nextTemplateId,
    });
  } catch (err) {
    logger.error("Program advance error:", err);
    return NextResponse.json({ advanced: false });
  }
}
