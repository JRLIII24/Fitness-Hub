/**
 * Start Program API
 * POST /api/programs/:id/start
 *
 * Sets the program to "active" and creates a template for Day 1 of Week 1 only.
 * Subsequent templates are created on-demand as each day is completed
 * (see POST /api/programs/advance).
 *
 * This prevents flooding the user's template list — only one program
 * template exists at any given time.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { createTemplateFromProgramDay, type ProgramDayData } from "@/lib/program-service";
import { logger } from "@/lib/logger";
import type { Json } from "@/types/database";
import { type Program } from "@/lib/ai-prompts/program-builder";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    // Fetch the program
    const { data: program, error: fetchErr } = await supabase
      .from("training_programs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchErr || !program) {
      return NextResponse.json({ error: "Program not found" }, { status: 404 });
    }

    if (program.status === "active") {
      return NextResponse.json({ error: "Program is already active" }, { status: 400 });
    }

    const programData = program.program_data as Program;
    if (!programData?.weeks?.length) {
      return NextResponse.json({ error: "Program has no week data" }, { status: 400 });
    }

    // Create a template for Week 1, Day 1 only
    const firstWeek = programData.weeks[0];
    const firstDay = firstWeek?.days?.[0];

    if (!firstDay) {
      return NextResponse.json({ error: "Program has no day data" }, { status: 400 });
    }

    const templateId = await createTemplateFromProgramDay(
      supabase,
      user.id,
      programData.name,
      firstWeek.week_number,
      firstDay,
      id,
    );

    // Embed the template_id into program_data so the active card and advance
    // endpoint can reference it without an extra query.
    const updatedWeeks = programData.weeks.map((week, wi) => ({
      ...week,
      days: week.days.map((day, di) => {
        if (wi === 0 && di === 0 && templateId) {
          return { ...day, template_id: templateId } as ProgramDayData & { template_id: string };
        }
        return day;
      }),
    }));

    const { error: updateErr } = await supabase
      .from("training_programs")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
        current_week: 1,
        current_day: 1,
        program_data: { ...programData, weeks: updatedWeeks } as unknown as Json,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateErr) {
      logger.error("Failed to activate program:", updateErr);
      return NextResponse.json({ error: "Failed to activate program" }, { status: 500 });
    }

    return NextResponse.json({
      started: true,
      template_id: templateId,
    });
  } catch (error) {
    logger.error("Program start error:", error);
    return NextResponse.json({ error: "Failed to start program" }, { status: 500 });
  }
}
