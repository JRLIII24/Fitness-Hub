import { createClient } from "@/lib/supabase/client";
import { safeSupabaseCall } from "./supabase-safe";
import { enqueueMutation } from "@/lib/offline/queue";

export async function createActiveRunSession(
  userId: string,
  runSessionId: string,
  sessionName: string,
  startedAt: string
) {
  const supabase = createClient();
  const promise = supabase.from("active_workout_sessions").upsert({
    user_id: userId,
    session_name: sessionName,
    started_at: startedAt,
    exercise_count: 0,
    run_session_id: runSessionId,
  });

  const result = await safeSupabaseCall(promise);
  if (!result.ok) {
    await enqueueMutation("UPSERT_ACTIVE_RUN", {
      userId,
      runSessionId,
      sessionName,
      startedAt,
    });
  }
  return result;
}

export async function deleteActiveRunSession(userId: string) {
  const supabase = createClient();
  const promise = supabase
    .from("active_workout_sessions")
    .delete()
    .eq("user_id", userId);

  const result = await safeSupabaseCall(promise);
  if (!result.ok) {
    await enqueueMutation("DELETE_ACTIVE_RUN", { userId });
  }
  return result;
}

if (typeof window !== "undefined") {
  window.addEventListener("sync-mutation", async (e: Event) => {
    const { mutation, db } = (e as CustomEvent).detail;
    if (mutation.type === "UPSERT_ACTIVE_RUN") {
      const res = await createActiveRunSession(
        mutation.payload.userId,
        mutation.payload.runSessionId,
        mutation.payload.sessionName,
        mutation.payload.startedAt
      );
      if (res.ok) {
        const tx = db.transaction("mutations", "readwrite");
        await tx.objectStore("mutations").delete(mutation.id);
        await tx.done;
      }
    } else if (mutation.type === "DELETE_ACTIVE_RUN") {
      const res = await deleteActiveRunSession(mutation.payload.userId);
      if (res.ok) {
        const tx = db.transaction("mutations", "readwrite");
        await tx.objectStore("mutations").delete(mutation.id);
        await tx.done;
      }
    }
  });
}
