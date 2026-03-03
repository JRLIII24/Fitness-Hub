/**
 * Exercise Search API Route
 * Provides fast, local database search across all exercises
 * Uses Postgres full-text search for instant results
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

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
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const query = searchParams.get("query") || "";
    const muscleGroups = searchParams.get("muscle_groups") || searchParams.get("muscle_group") || "";
    const equipment = searchParams.get("equipment") || "";
    const category = searchParams.get("category") || "";
    const source = searchParams.get("source") || "";
    const rawLimit = searchParams.get("limit");
    const limit = Math.min(10000, Math.max(1, parseInt(rawLimit ?? '100', 10)));

    // Create Supabase client
    const supabase = await createClient();

    // Start building the query
    let supabaseQuery = supabase
      .from("exercises")
      .select("id, name, slug, muscle_group, equipment, category, instructions, image_url, gif_url, source");

    // Apply filters
    if (muscleGroups) {
      const groups = muscleGroups.split(",").map((g) => g.trim()).filter(Boolean);
      if (groups.length === 1) {
        supabaseQuery = supabaseQuery.eq("muscle_group", groups[0]);
      } else if (groups.length > 1) {
        supabaseQuery = supabaseQuery.in("muscle_group", groups);
      }
    }

    if (equipment) {
      supabaseQuery = supabaseQuery.eq("equipment", equipment);
    }

    if (category) {
      supabaseQuery = supabaseQuery.eq("category", category);
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
      console.error("Exercise search error:", error);
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
    console.error("Exercise search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
