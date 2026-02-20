/**
 * Single Exercise Fetch API Route
 * Retrieves a single exercise by ID
 */

import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Create Supabase client
    const supabase = await createClient();

    // Fetch exercise by ID
    const { data: exercise, error } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // Not found
        return NextResponse.json(
          { error: "Exercise not found" },
          { status: 404 }
        );
      }

      console.error("Exercise fetch error:", error);
      return NextResponse.json(
        { error: "Failed to fetch exercise" },
        { status: 500 }
      );
    }

    return NextResponse.json({ exercise });
  } catch (error) {
    console.error("Exercise fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
