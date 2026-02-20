import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetentionEventInput } from "@/types/retention";

let hasWarnedRetentionLogger = false;

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = (err as { message?: unknown }).message;
    if (typeof msg === "string") return msg;
  }
  return "";
}

function isIgnorableRetentionError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;

  const code = "code" in err ? (err as { code?: unknown }).code : undefined;
  if (code === "42P01") return true; // undefined_table

  const message = getErrorMessage(err).toLowerCase();
  return message.includes("retention_events") && message.includes("does not exist");
}

export async function logRetentionEvent(
  supabase: SupabaseClient,
  input: RetentionEventInput
) {
  try {
    const { error } = await supabase.from("retention_events").insert({
      user_id: input.userId,
      event_type: input.eventType,
      source_screen: input.sourceScreen ?? null,
      metadata: input.metadata ?? {},
    });

    if (error) throw error;
  } catch (err) {
    // Keep UX resilient even if analytics table is not migrated yet.
    // Avoid noisy console spam in expected transitional states.
    if (isIgnorableRetentionError(err)) {
      if (!hasWarnedRetentionLogger) {
        hasWarnedRetentionLogger = true;
        console.warn(
          "Retention logger disabled: apply migration 034_retention_events_logger.sql to enable event tracking."
        );
      }
      return;
    }

    if (!hasWarnedRetentionLogger) {
      hasWarnedRetentionLogger = true;
      const details = getErrorMessage(err);
      console.warn(
        details
          ? `Retention logger unavailable (${details}).`
          : "Retention logger unavailable."
      );
    }
  }
}

export async function trackClipViewed(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_viewed",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackClipLike(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_liked",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackClipUnlike(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_unliked",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackClipCommentsOpened(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_comments_opened",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackClipCommentPosted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_comment_posted",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackClipUploaded(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_uploaded",
    sourceScreen: "sets_upload",
    metadata,
  });
}

export async function trackClipDeleted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "clip_deleted",
    sourceScreen: "sets_feed",
    metadata,
  });
}

export async function trackProfileSetOpened(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "profile_set_opened",
    sourceScreen: "social_profile",
    metadata,
  });
}

export async function trackSessionIntentSet(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "session_intent_set",
    sourceScreen: "workout",
    metadata,
  });
}

export async function trackSessionIntentCompleted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "session_intent_completed",
    sourceScreen: "workout",
    metadata,
  });
}

export async function trackNutritionCatchupNudgeShown(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "nutrition_catchup_nudge_shown",
    sourceScreen: "nutrition",
    metadata,
  });
}

export async function trackNutritionCatchupCompleted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "nutrition_catchup_completed",
    sourceScreen: "nutrition",
    metadata,
  });
}

export async function trackPodCommitmentSet(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "pod_commitment_set",
    sourceScreen: "pods",
    metadata,
  });
}

export async function trackPodCommitmentMissed(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "pod_commitment_missed",
    sourceScreen: "pods",
    metadata,
  });
}

export async function trackPodAccountabilityPingSent(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "pod_accountability_ping_sent",
    sourceScreen: "pods",
    metadata,
  });
}

export async function trackPodAccountabilityPingOpened(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "pod_accountability_ping_opened",
    sourceScreen: "social",
    metadata,
  });
}

export async function trackComebackPlanStarted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "comeback_plan_started",
    sourceScreen: "dashboard",
    metadata,
  });
}

export async function trackComebackPlanCompleted(
  supabase: SupabaseClient,
  userId: string,
  metadata: Record<string, unknown>
) {
  return logRetentionEvent(supabase, {
    userId,
    eventType: "comeback_plan_completed",
    sourceScreen: "dashboard",
    metadata,
  });
}
