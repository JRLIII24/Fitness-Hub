/**
 * Form Video Retention Cron
 * GET /api/cron/form-video-retention
 *
 * Scheduled daily at 04:00 UTC via vercel.json.
 * Calls the delete_expired_form_videos RPC (which returns storage paths + deletes DB rows),
 * then deletes the storage objects via Supabase Storage API.
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Use service role client for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json({ error: "Missing config" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Call RPC to get expired paths and delete DB rows
    const { data, error } = await supabase.rpc("delete_expired_form_videos", {
      batch_size: 200,
    });

    if (error) {
      logger.error("Retention RPC error:", error);
      return NextResponse.json({ error: "RPC failed" }, { status: 500 });
    }

    const row = Array.isArray(data) ? data[0] : data;
    const deletedCount = row?.deleted_count ?? 0;
    const storagePaths: string[] = row?.storage_paths ?? [];

    // Delete storage objects
    let storageFailures = 0;
    if (storagePaths.length > 0) {
      const { error: storageErr } = await supabase.storage
        .from("form-videos")
        .remove(storagePaths);

      if (storageErr) {
        logger.error("Storage deletion error:", storageErr);
        storageFailures = storagePaths.length;
      }
    }

    logger.log(
      `Form video retention: deleted=${deletedCount}, storage_paths=${storagePaths.length}, storage_failures=${storageFailures}`,
    );

    return NextResponse.json({
      deleted_count: deletedCount,
      storage_paths_removed: storagePaths.length - storageFailures,
      storage_failures: storageFailures,
    });
  } catch (error) {
    logger.error("Retention cron error:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
