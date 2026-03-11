/**
 * Program Skip API
 * POST /api/programs/skip
 *
 * Advances the active program one day WITHOUT requiring a completed workout.
 * Creates a template for the SKIPPED day (so the user can still do it later),
 * then moves current_day forward.
 *
 * If skipping the last day of the last week → marks program as completed.
 *
 * Body: { program_id: string }
 *
 * Response:
 *   { skipped: true, current_week, current_day, day_name, template_id }
 *   { skipped: false, reason: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { createTemplateFromProgramDay, type ProgramDayData } from "@/lib/program-service";
import { logger } from "@/lib/logger";

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

    const { program_id } = await request.json() as { program_id: string };
    if (!program_id) {
      return NextResponse.json({ skipped: false, reason: "Missing program_id" }, { status: 400 });
    }

    const { data: program } = await supabase
      .from("training_programs")
      .select("id, current_week, current_day, program_data")
      .eq("id", program_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!program) {
      return NextResponse.json({ skipped: false, reason: "Active program not found" }, { status: 404 });
    }

    const programData = program.program_data as ProgramData;
    const currentWeek = program.current_week ?? 1;
    const currentDay = program.current_day ?? 1;
    const totalWeeks = programData.weeks.length;

    const currentWeekData = programData.weeks.find((w) => w.week_number === currentWeek);
    const daysInCurrentWeek = currentWeekData?.days?.length ?? 0;
    const currentDayData = currentWeekData?.days?.find((d) => d.day_number === currentDay);

    // Create template for the current (skipped) day if it doesn't have one yet
    let updatedWeeks = programData.weeks;
    if (currentDayData && !currentDayData.template_id) {
      const skippedTemplateId = await createTemplateFromProgramDay(
        supabase,
        user.id,
        programData.name,
        currentWeek,
        currentDayData as ProgramDayData,
        program_id,
      );

      if (skippedTemplateId) {
        updatedWeeks = programData.weeks.map((week) => ({
          ...week,
          days: week.days.map((day) => {
            if (week.week_number === currentWeek && day.day_number === currentDay) {
              return { ...day, template_id: skippedTemplateId };
            }
            return day;
          }),
        }));
      }
    }

    // Compute next position
    let nextWeek = currentWeek;
    let nextDay = currentDay + 1;

    if (nextDay > daysInCurrentWeek) {
      nextWeek = currentWeek + 1;
      nextDay = 1;
    }

    // Skipping the last day of the last week → program complete
    if (nextWeek > totalWeeks) {
      await supabase
        .from("training_programs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          current_week: totalWeeks,
          current_day: daysInCurrentWeek,
          program_data: { ...programData, weeks: updatedWeeks },
        })
        .eq("id", program_id)
        .eq("user_id", user.id);

      return NextResponse.json({ skipped: true, completed: true });
    }

    // Create template for the NEXT day (the new current day)
    const nextWeekData = programData.weeks.find((w) => w.week_number === nextWeek);
    const nextDayData = nextWeekData?.days?.find((d) => d.day_number === nextDay);

    let nextTemplateId: string | null = null;

    if (nextDayData && !nextDayData.template_id) {
      nextTemplateId = await createTemplateFromProgramDay(
        supabase,
        user.id,
        programData.name,
        nextWeek,
        nextDayData as ProgramDayData,
        program_id,
      );

      if (nextTemplateId) {
        updatedWeeks = updatedWeeks.map((week) => ({
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
      nextTemplateId = nextDayData?.template_id ?? null;
    }

    const { error: updateErr } = await supabase
      .from("training_programs")
      .update({
        current_week: nextWeek,
        current_day: nextDay,
        program_data: { ...programData, weeks: updatedWeeks },
      })
      .eq("id", program_id)
      .eq("user_id", user.id);

    if (updateErr) {
      logger.error("Skip: failed to update program", updateErr);
      return NextResponse.json({ skipped: false, reason: "Failed to update program" }, { status: 500 });
    }

    return NextResponse.json({
      skipped: true,
      current_week: nextWeek,
      current_day: nextDay,
      day_name: nextDayData?.name ?? `Day ${nextDay}`,
      template_id: nextTemplateId,
    });
  } catch (err) {
    logger.error("Skip error:", err);
    return NextResponse.json({ skipped: false, reason: "Server error" }, { status: 500 });
  }
}
