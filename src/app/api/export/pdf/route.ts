import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth-utils";
import { logger } from "@/lib/logger";
import { format, formatDuration, intervalToDuration } from "date-fns";
import { KG_TO_LBS } from "@/lib/units";
import { generateProgressPDF, type PDFReportData } from "@/lib/pdf-export";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { user, response: authErr } = await requireAuth(supabase);
    if (authErr) return authErr;

    const body = await req.json().catch(() => ({}));
    const { start, end, unitPreference = "metric" } = body as {
      start?: string;
      end?: string;
      unitPreference?: "metric" | "imperial";
    };

    const volumeFactor = unitPreference === "imperial" ? KG_TO_LBS : 1;
    const unitLabel = unitPreference === "imperial" ? "lbs" : "kg";
    const toDisplayWeight = (kg: number) => Math.round(kg * volumeFactor * 10) / 10;
    const toDisplayVolumeValue = (kgVolume: number) => kgVolume * volumeFactor;

    // Fetch completed sessions (paginated — max 500 for PDF)
    let sessionsQuery = supabase
      .from("workout_sessions")
      .select("id, name, started_at, completed_at, duration_seconds, total_volume_kg")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("started_at", { ascending: false })
      .limit(500);

    if (start) sessionsQuery = sessionsQuery.gte("started_at", start);
    if (end) sessionsQuery = sessionsQuery.lte("started_at", end);

    const { data: sessions, error: sessErr } = await sessionsQuery;
    if (sessErr) {
      logger.error("PDF export sessions error:", sessErr);
      return NextResponse.json({ error: "Failed to load sessions." }, { status: 500 });
    }
    if (!sessions?.length) {
      return NextResponse.json({ error: "No completed workouts found in this date range." }, { status: 404 });
    }

    // Fetch sets in batches to avoid OOM
    const BATCH_SIZE = 200;
    const sessionIds = sessions.map((s) => s.id);
    type SetRow = {
      session_id: string;
      reps: number | null;
      weight_kg: number | null;
      set_type: string | null;
      exercises: { name: string; muscle_group: string } | { name: string; muscle_group: string }[] | null;
    };
    const allSets: SetRow[] = [];

    for (let i = 0; i < sessionIds.length; i += BATCH_SIZE) {
      const batch = sessionIds.slice(i, i + BATCH_SIZE);
      const { data: batchSets, error: batchErr } = await supabase
        .from("workout_sets")
        .select("session_id, reps, weight_kg, set_type, exercises(name, muscle_group)")
        .in("session_id", batch)
        .order("sort_order", { ascending: true });

      if (batchErr) {
        logger.error("PDF export sets batch error:", batchErr);
        return NextResponse.json({ error: "Failed to load set data." }, { status: 500 });
      }
      allSets.push(...((batchSets ?? []) as unknown as SetRow[]));
    }

    // Group sets by session
    type ExSummary = { name: string; group: string; sets: { w: number; r: number }[] };
    const setsBySession = new Map<string, Map<string, ExSummary>>();

    for (const set of allSets) {
      const ex = Array.isArray(set.exercises) ? set.exercises[0] : set.exercises;
      const exName = ex?.name ?? "Unknown Exercise";
      const exGroup = ex?.muscle_group ?? "";
      if (!setsBySession.has(set.session_id)) setsBySession.set(set.session_id, new Map());
      const exMap = setsBySession.get(set.session_id)!;
      if (!exMap.has(exName)) exMap.set(exName, { name: exName, group: exGroup, sets: [] });
      if (set.weight_kg != null) {
        exMap.get(exName)!.sets.push({ w: set.weight_kg, r: set.reps ?? 0 });
      }
    }

    // Build strength chart sparklines
    const prMap = new Map<string, {
      name: string; group: string;
      sessionData: Map<string, number>;
    }>();

    for (const set of allSets) {
      const setEx = Array.isArray(set.exercises) ? set.exercises[0] : set.exercises;
      const exName = setEx?.name;
      if (!exName || set.weight_kg == null) continue;
      const score = (set.weight_kg * volumeFactor) * (set.reps ?? 1);
      if (!prMap.has(exName)) {
        prMap.set(exName, {
          name: exName,
          group: setEx?.muscle_group ?? "",
          sessionData: new Map(),
        });
      }
      const ex = prMap.get(exName)!;
      const cur = ex.sessionData.get(set.session_id) ?? 0;
      if (score > cur) ex.sessionData.set(set.session_id, score);
    }

    const strengthCharts: PDFReportData["strengthCharts"] = [...prMap.values()]
      .map((ex) => {
        const ordered = sessions
          .filter((s) => ex.sessionData.has(s.id))
          .map((s) => ({ date: format(new Date(s.started_at), "MMM d"), value: Math.round(ex.sessionData.get(s.id)!) }));
        const first = ordered[0]?.value ?? 0;
        const last = ordered[ordered.length - 1]?.value ?? 0;
        const trend = first > 0 ? ((last - first) / first) * 100 : 0;
        return { name: ex.name, muscleGroup: ex.group, dataPoints: ordered, trend, unitLabel };
      })
      .filter((c) => c.dataPoints.length >= 2)
      .sort((a, b) => Math.abs(b.trend) - Math.abs(a.trend))
      .slice(0, 6);

    // Build personal records
    const personalRecords: PDFReportData["personalRecords"] = [...prMap.values()]
      .map((ex) => {
        let bestScore = 0;
        let bestW = 0, bestR = 0;
        let bestDate = "";
        for (const set of allSets) {
          const setEx2 = Array.isArray(set.exercises) ? set.exercises[0] : set.exercises;
          if (setEx2?.name !== ex.name || set.weight_kg == null) continue;
          const score = (set.weight_kg * volumeFactor) * (set.reps ?? 1);
          if (score > bestScore) {
            bestScore = score;
            bestW = toDisplayWeight(set.weight_kg);
            bestR = set.reps ?? 0;
            const sess = sessions.find((s) => s.id === set.session_id);
            bestDate = sess ? format(new Date(sess.started_at), "MMM d, yyyy") : "";
          }
        }
        return { name: ex.name, muscleGroup: ex.group, bestWeight: bestW, bestReps: bestR, date: bestDate };
      })
      .filter((pr) => pr.bestWeight > 0)
      .sort((a, b) => b.bestWeight * b.bestReps - a.bestWeight * a.bestReps)
      .slice(0, 15);

    // Build session summaries (top 20)
    const sessionSummaries = sessions.slice(0, 20).map((s) => {
      const exMap = setsBySession.get(s.id);
      const exercises = exMap
        ? [...exMap.values()].map((ex) => {
            const maxW = Math.max(...ex.sets.map((st) => st.w));
            return `${ex.name}: ${ex.sets.length} set${ex.sets.length !== 1 ? "s" : ""} · up to ${toDisplayWeight(maxW)} ${unitLabel}`;
          })
        : [];

      let durationStr = "";
      if (s.duration_seconds) {
        const dur = intervalToDuration({ start: 0, end: s.duration_seconds * 1000 });
        durationStr = formatDuration(dur, { format: ["hours", "minutes"] }) || `${s.duration_seconds}s`;
      }

      return {
        name: s.name || "Unnamed Workout",
        date: format(new Date(s.started_at), "EEEE, MMM d, yyyy"),
        time: format(new Date(s.started_at), "h:mm a"),
        duration: durationStr,
        volume: s.total_volume_kg
          ? `${Math.round(toDisplayVolumeValue(s.total_volume_kg)).toLocaleString()} ${unitLabel} total`
          : null,
        exercises,
      };
    });

    // Generate PDF (server-side — return buffer, don't trigger browser download)
    const pdfBytes = await generateProgressPDF(
      {
        userName: user.email?.split("@")[0] ?? "Athlete",
        reportDate: new Date(),
        totalSessions: sessions.length,
        totalPRs: personalRecords.length,
        avgVolume: toDisplayVolumeValue(
          sessions.reduce((s, r) => s + (r.total_volume_kg ?? 0), 0) / sessions.length
        ),
        strengthCharts,
        personalRecords,
        sessionSummaries,
      },
      { returnBuffer: true }
    );

    return new NextResponse(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="fithub_progress_report.pdf"`,
      },
    });
  } catch (error) {
    logger.error("PDF export error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
