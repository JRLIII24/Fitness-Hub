/**
 * One-time script: Purge all objects from the workout-clips storage bucket.
 *
 * Run AFTER migration 073 has been applied (clip tables dropped).
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.
 *
 * Usage:
 *   npx tsx scripts/purge-workout-clips.ts
 */

import { createClient } from "@supabase/supabase-js";

const BUCKET = "workout-clips";
const BATCH_SIZE = 1000;

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  console.log(`Purging all objects from bucket: ${BUCKET}`);

  let totalDeleted = 0;
  let hasMore = true;

  while (hasMore) {
    const { data: files, error: listErr } = await supabase.storage
      .from(BUCKET)
      .list("", { limit: BATCH_SIZE });

    if (listErr) {
      console.error("Failed to list objects:", listErr);
      break;
    }

    if (!files || files.length === 0) {
      hasMore = false;
      break;
    }

    const paths = files.map((f) => f.name);
    const { error: removeErr } = await supabase.storage
      .from(BUCKET)
      .remove(paths);

    if (removeErr) {
      console.error(`Failed to delete batch of ${paths.length}:`, removeErr);
      break;
    }

    totalDeleted += paths.length;
    console.log(`Deleted ${paths.length} objects (total: ${totalDeleted})`);

    if (files.length < BATCH_SIZE) {
      hasMore = false;
    }
  }

  console.log(`\nDone. Total objects deleted: ${totalDeleted}`);

  // Verify bucket is empty
  const { data: remaining } = await supabase.storage
    .from(BUCKET)
    .list("", { limit: 1 });

  if (remaining && remaining.length > 0) {
    console.warn("Warning: Bucket is not empty. Some objects may be in subdirectories.");
    console.warn("Consider listing with path prefixes to find remaining objects.");
  } else {
    console.log("Bucket is empty. You may now delete the bucket via Supabase dashboard.");
  }
}

main().catch(console.error);
