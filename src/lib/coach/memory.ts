/**
 * Coach Memory Service — persistent facts the AI coach remembers about each user.
 *
 * Memories are loaded into every coach prompt so the AI can reference past
 * conversations. The AI decides what is worth remembering via the save_memory action.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type MemoryCategory = "preference" | "injury" | "goal" | "note";

export interface CoachMemory {
  id: string;
  user_id: string;
  category: MemoryCategory;
  content: string;
  source: "coach" | "user";
  created_at: string;
  updated_at: string;
}

const MAX_MEMORIES = 50;

/**
 * Fetch all coach memories for a user, ordered by most recently updated.
 */
export async function getCoachMemories(
  supabase: SupabaseClient,
  userId: string,
): Promise<CoachMemory[]> {
  const { data, error } = await supabase
    .from("coach_memories")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_MEMORIES);

  if (error) {
    console.error("Failed to fetch coach memories:", error.message);
    return [];
  }

  return (data ?? []) as CoachMemory[];
}

/**
 * Save a new coach memory. If an identical content already exists in the same
 * category, updates its timestamp instead of creating a duplicate.
 */
export async function saveCoachMemory(
  supabase: SupabaseClient,
  userId: string,
  category: MemoryCategory,
  content: string,
  source: "coach" | "user" = "coach",
): Promise<CoachMemory | null> {
  // Check for duplicate content in same category
  const { data: existing } = await supabase
    .from("coach_memories")
    .select("id")
    .eq("user_id", userId)
    .eq("category", category)
    .eq("content", content)
    .limit(1);

  if (existing && existing.length > 0) {
    // Touch the updated_at timestamp
    const { data, error } = await supabase
      .from("coach_memories")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", existing[0].id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update coach memory:", error.message);
      return null;
    }
    return data as CoachMemory;
  }

  const { data, error } = await supabase
    .from("coach_memories")
    .insert({ user_id: userId, category, content, source })
    .select()
    .single();

  if (error) {
    console.error("Failed to save coach memory:", error.message);
    return null;
  }

  return data as CoachMemory;
}

/**
 * Delete a specific coach memory by ID (scoped to user via RLS).
 */
export async function deleteCoachMemory(
  supabase: SupabaseClient,
  userId: string,
  memoryId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("coach_memories")
    .delete()
    .eq("id", memoryId)
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to delete coach memory:", error.message);
    return false;
  }
  return true;
}

/**
 * Format memories into a readable block for the system prompt.
 * Returns an empty string if there are no memories.
 */
export function formatMemoriesForPrompt(memories: CoachMemory[]): string {
  if (!memories.length) return "";

  const grouped: Record<string, string[]> = {
    injury: [],
    goal: [],
    preference: [],
    note: [],
  };

  for (const m of memories) {
    if (grouped[m.category]) {
      grouped[m.category].push(m.content);
    }
  }

  const sections: string[] = [];

  if (grouped.injury.length) {
    sections.push(`Injuries/limitations:\n${grouped.injury.map((c) => `- ${c}`).join("\n")}`);
  }
  if (grouped.goal.length) {
    sections.push(`Goals:\n${grouped.goal.map((c) => `- ${c}`).join("\n")}`);
  }
  if (grouped.preference.length) {
    sections.push(`Preferences:\n${grouped.preference.map((c) => `- ${c}`).join("\n")}`);
  }
  if (grouped.note.length) {
    sections.push(`Notes:\n${grouped.note.map((c) => `- ${c}`).join("\n")}`);
  }

  return sections.join("\n\n");
}
