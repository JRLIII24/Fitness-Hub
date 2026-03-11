/**
 * Program Go-Back API
 * POST /api/programs/back
 *
 * Moves the active program backwards one day. Wraps to the previous week's
 * last day when already on day 1. Refuses to go before Week 1 Day 1.
 *
 * Does NOT delete any existing templates — prior days keep their template_id
 * in program_data so they can be started again if needed.
 *
 * Body: { program_id: string }
 *
 * Response:
 *   { backed: true, current_week, current_day, day_name, template_id }
 *   { backed: false, reason: string }
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";

interface ProgramDay {
  day_number: number;
  name: string;
  template_id?: string;
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
      return NextResponse.json({ backed: false, reason: "Missing program_id" }, { status: 400 });
    }

    const { data: program } = await supabase
      .from("training_programs")
      .select("id, current_week, current_day, program_data")
      .eq("id", program_id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .single();

    if (!program) {
      return NextResponse.json({ backed: false, reason: "Active program not found" }, { status: 404 });
    }

    const programData = program.program_data as ProgramData;
    const currentWeek = program.current_week ?? 1;
    const currentDay = program.current_day ?? 1;

    // Already at the very start
    if (currentWeek === 1 && currentDay === 1) {
      return NextResponse.json({ backed: false, reason: "Already at the beginning of the program" });
    }

    let prevWeek = currentWeek;
    let prevDay = currentDay - 1;

    if (prevDay < 1) {
      prevWeek = currentWeek - 1;
      const prevWeekData = programData.weeks.find((w) => w.week_number === prevWeek);
      prevDay = prevWeekData?.days?.length ?? 1;
    }

    const prevWeekData = programData.weeks.find((w) => w.week_number === prevWeek);
    const prevDayData = prevWeekData?.days?.find((d) => d.day_number === prevDay);

    const { error: updateErr } = await supabase
      .from("training_programs")
      .update({ current_week: prevWeek, current_day: prevDay })
      .eq("id", program_id)
      .eq("user_id", user.id);

    if (updateErr) {
      return NextResponse.json({ backed: false, reason: "Failed to update program" }, { status: 500 });
    }

    return NextResponse.json({
      backed: true,
      current_week: prevWeek,
      current_day: prevDay,
      day_name: prevDayData?.name ?? `Day ${prevDay}`,
      template_id: prevDayData?.template_id ?? null,
    });
  } catch {
    return NextResponse.json({ backed: false, reason: "Server error" }, { status: 500 });
  }
}
