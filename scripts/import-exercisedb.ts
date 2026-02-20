/**
 * Exercise Data Import Script
 * Downloads ExerciseDB and Free Exercise DB datasets from GitHub
 * Normalizes and imports into Supabase
 *
 * Usage: pnpm tsx scripts/import-exercisedb.ts
 */

// Load environment variables from .env.local
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import type {
  ExerciseDBExercise,
  FreeExerciseDBExercise,
  InternalExercise,
} from "../src/types/exercise-data";
import {
  normalizeExerciseDB,
  normalizeFreeExerciseDB,
  deduplicateExercises,
  validateExercise,
} from "./normalize-exercise-data";

// Supabase client (requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env)
const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role for admin operations
  {
    auth: { persistSession: false },
  }
);

// GitHub raw file URLs
const WRKOUT_EXERCISES_URL =
  "https://raw.githubusercontent.com/wrkout/exercises.json/master/exercises.json";
const FREE_EXERCISE_DB_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

/**
 * Fetch JSON data from URL
 */
async function fetchJSON<T>(url: string): Promise<T> {
  console.log(`Fetching data from ${url}...`);
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Batch insert exercises into Supabase
 */
async function batchInsertExercises(exercises: InternalExercise[]): Promise<number> {
  const BATCH_SIZE = 100; // Insert 100 exercises at a time
  let totalInserted = 0;

  for (let i = 0; i < exercises.length; i += BATCH_SIZE) {
    const batch = exercises.slice(i, i + BATCH_SIZE);

    // Use insert instead of upsert to avoid conflict issues
    // The unique index will prevent duplicates automatically
    const { data, error } = await supabase
      .from("exercises")
      .insert(batch as any)
      .select("id");

    if (error) {
      // If it's a unique constraint error, that's okay (duplicate exercise)
      if (error.code === "23505") {
        console.log(`Batch ${i / BATCH_SIZE + 1}: Skipped duplicates`);
      } else {
        console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error.message);
      }
      // Continue with next batch
    } else {
      totalInserted += data?.length || 0;
      console.log(`✅ Inserted batch ${i / BATCH_SIZE + 1} (${data?.length || 0} exercises)`);
    }
  }

  return totalInserted;
}

/**
 * Main import function
 */
async function importExercises() {
  console.log("🏋️  Starting Exercise Data Import...\n");

  try {
    // Step 1: Fetch wrkout exercises data
    console.log("Step 1: Fetching wrkout/exercises.json data from GitHub...");
    let wrkoutData: FreeExerciseDBExercise[] = [];
    try {
      wrkoutData = await fetchJSON<FreeExerciseDBExercise[]>(WRKOUT_EXERCISES_URL);
      console.log(`✅ Fetched ${wrkoutData.length} exercises from wrkout/exercises.json\n`);
    } catch (error) {
      console.log(`⚠️  Could not fetch wrkout exercises (will continue with Free Exercise DB only)\n`);
    }

    // Step 2: Fetch Free Exercise DB data
    console.log("Step 2: Fetching Free Exercise DB data from GitHub...");
    const freeExerciseDBData = await fetchJSON<FreeExerciseDBExercise[]>(FREE_EXERCISE_DB_URL);
    console.log(`✅ Fetched ${freeExerciseDBData.length} exercises from Free Exercise DB\n`);

    // Step 3: Normalize data
    console.log("Step 3: Normalizing exercise data...");
    const normalizedWrkout = wrkoutData.map(normalizeFreeExerciseDB);
    const normalizedFreeExerciseDB = freeExerciseDBData.map(normalizeFreeExerciseDB);
    console.log(`✅ Normalized ${normalizedWrkout.length + normalizedFreeExerciseDB.length} exercises\n`);

    // Step 4: Combine and deduplicate
    console.log("Step 4: Deduplicating exercises...");
    const allExercises = [...normalizedWrkout, ...normalizedFreeExerciseDB];
    const deduplicatedExercises = deduplicateExercises(allExercises);
    console.log(`✅ Deduplicated to ${deduplicatedExercises.length} unique exercises\n`);

    // Step 5: Validate exercises
    console.log("Step 5: Validating exercise data...");
    const validExercises = deduplicatedExercises.filter(validateExercise);
    console.log(`✅ ${validExercises.length} exercises passed validation (${deduplicatedExercises.length - validExercises.length} filtered out)\n`);

    // Step 6: Import to Supabase
    console.log("Step 6: Importing exercises to Supabase...");
    const totalInserted = await batchInsertExercises(validExercises);
    console.log(`✅ Successfully imported ${totalInserted} exercises to database\n`);

    // Step 7: Summary stats
    console.log("📊 Import Summary:");
    console.log(`  - Wrkout Exercises:  ${normalizedWrkout.length} exercises`);
    console.log(`  - Free Exercise DB:  ${normalizedFreeExerciseDB.length} exercises`);
    console.log(`  - After deduplication: ${deduplicatedExercises.length} exercises`);
    console.log(`  - After validation:  ${validExercises.length} exercises`);
    console.log(`  - Inserted to DB:    ${totalInserted} exercises`);

    // Step 8: Breakdown by source
    const freeExerciseDBCount = await supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("source", "free-exercise-db");

    console.log(`\n📈 Database Counts:`);
    console.log(`  - Free Exercise DB:  ${freeExerciseDBCount.count || 0} exercises`);

    console.log(`\n✅ Import complete!`);
  } catch (error) {
    console.error("❌ Import failed:", error);
    process.exit(1);
  }
}

// Run the import
importExercises();
