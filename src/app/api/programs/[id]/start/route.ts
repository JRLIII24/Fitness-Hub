/**
 * Start Program API
 * POST /api/programs/:id/start
 *
 * Creates workout templates for each day in the program, links them
 * via template_id in program_data, and sets status to "active".
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { createTemplateFromProgramDay, type ProgramDayData } from "@/lib/program-service";
import { logger } from "@/lib/logger";
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

    // Create templates for each day in each week
    let templatesCreated = 0;
    const updatedWeeks = [...programData.weeks];

    for (let wi = 0; wi < updatedWeeks.length; wi++) {
      const week = updatedWeeks[wi];
      const updatedDays = [...week.days];

      for (let di = 0; di < updatedDays.length; di++) {
        const day = updatedDays[di];
        const templateId = await createTemplateFromProgramDay(
          supabase,
          user.id,
          programData.name,
          week.week_number,
          day,
        );

        if (templateId) {
          // Attach template_id to the day data
          updatedDays[di] = { ...day, template_id: templateId } as ProgramDayData & { template_id: string };
          templatesCreated++;
        }
      }

      updatedWeeks[wi] = { ...week, days: updatedDays };
    }

    // Update program with template IDs and set active
    const { error: updateErr } = await supabase
      .from("training_programs")
      .update({
        status: "active",
        started_at: new Date().toISOString(),
        current_week: 1,
        current_day: 1,
        program_data: { ...programData, weeks: updatedWeeks },
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateErr) {
      logger.error("Failed to activate program:", updateErr);
      return NextResponse.json({ error: "Failed to activate program" }, { status: 500 });
    }

    return NextResponse.json({
      started: true,
      templates_created: templatesCreated,
    });
  } catch (error) {
    logger.error("Program start error:", error);
    return NextResponse.json({ error: "Failed to start program" }, { status: 500 });
  }
}
