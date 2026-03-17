/**
 * Exercise Search API Route
 * Provides fast, local database search across all exercises
 * Uses Postgres full-text search for instant results
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { exerciseSearchSchema } from "@/lib/validation/api.schemas";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
const FREE_EXERCISE_DB_IMAGE_BASE =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";

function normalizeMediaUrl(url: string | null | undefined, source?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  // Free Exercise DB often stores relative paths like "Barbell-Squat/0.jpg"
  if (source === "free-exercise-db") {
    const clean = trimmed.replace(/^\/+/, "");
    return `${FREE_EXERCISE_DB_IMAGE_BASE}${clean}`;
  }

  return null;
}

export async function GET(request: Request) {
  try {
    // Rate limit by IP to prevent scraping (60 req/min)
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const allowed = await rateLimit(`exercise-search:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);

    // Validate and coerce query parameters via the shared schema.
    // This enforces the 200-row limit cap and the source enum in one place,
    // keeping the route handler free of ad-hoc parsing logic.
    const parseResult = exerciseSearchSchema.safeParse(
      Object.fromEntries(searchParams.entries()),
    );
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parseResult.error.flatten() },
        { status: 400 },
      );
    }

    // Prefer muscle_groups over muscle_group when both are supplied (legacy compat)
    const {
      query,
      muscle_groups,
      muscle_group,
      equipment,
      category,
      source,
      limit,
    } = parseResult.data;
    const muscleGroups = muscle_groups || muscle_group;

    // Create Supabase client
    const supabase = await createClient();

    // Start building the query
    let supabaseQuery = supabase
      .from("exercises")
      .select("id, name, slug, muscle_group, equipment, category, instructions, image_url, gif_url, source, is_custom");

    // Apply filters
    if (muscleGroups) {
      const groups = muscleGroups.split(",").map((g) => g.trim()).filter(Boolean);
      if (groups.length === 1) {
        supabaseQuery = supabaseQuery.eq("muscle_group", groups[0] as any);
      } else if (groups.length > 1) {
        supabaseQuery = supabaseQuery.in("muscle_group", groups as any);
      }
    }

    if (equipment) {
      supabaseQuery = supabaseQuery.eq("equipment", equipment as any);
    }

    if (category) {
      supabaseQuery = supabaseQuery.eq("category", category as any);
    }

    if (source) {
      supabaseQuery = supabaseQuery.eq("source", source);
    }

    // Apply text search if query is provided
    if (query && query.trim().length > 0) {
      // Use Postgres full-text search via textSearch
      // This uses the GIN index we created in migration 028
      supabaseQuery = supabaseQuery.textSearch("name", query, {
        type: "websearch",
        config: "english",
      });
    }

    // Apply limit and ordering
    supabaseQuery = supabaseQuery.order("name", { ascending: true }).limit(limit);

    // Execute query
    const { data: exercises, error } = await supabaseQuery;

    if (error) {
      logger.error("Exercise search error:", error);
      return NextResponse.json(
        { error: "Failed to search exercises" },
        { status: 500 }
      );
    }

    const normalizedExercises = (exercises ?? []).map((exercise) => ({
      ...exercise,
      gif_url: normalizeMediaUrl(exercise.gif_url, exercise.source),
      image_url: normalizeMediaUrl(exercise.image_url, exercise.source),
    }));

    // Return results with metadata
    return NextResponse.json(
      {
        exercises: normalizedExercises,
        count: normalizedExercises.length,
        filters: {
          query,
          muscle_groups: muscleGroups,
          equipment,
          category,
          source,
        },
      },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    logger.error("Exercise search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
