/**
 * Coach Conversation Service — persistent chat history between users and APEX.
 * Conversations auto-create when none exists or the last one is >4 hours old.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CoachAction } from "./types";

export interface ConversationRow {
  id: string;
  user_id: string;
  session_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  action: string | null;
  action_data: Record<string, unknown> | null;
  action_result: { success: boolean; message: string } | null;
  created_at: string;
}

const CONVERSATION_GAP_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Get the active conversation for a user, or create a new one if none exists
 * or the latest is older than 4 hours.
 */
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  userId: string,
  sessionId?: string,
): Promise<string> {
  // Try to find an active conversation
  const { data: latest } = await supabase
    .from("coach_conversations")
    .select("id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (latest) {
    const age = Date.now() - new Date(latest.updated_at).getTime();
    if (age < CONVERSATION_GAP_MS) {
      return latest.id;
    }
  }

  // Create new conversation
  const { data, error } = await supabase
    .from("coach_conversations")
    .insert({
      user_id: userId,
      session_id: sessionId ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);
  return data.id;
}

/**
 * Save a message to a conversation.
 */
export async function saveMessage(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  msg: {
    role: "user" | "assistant";
    content: string;
    action?: CoachAction | null;
    actionData?: Record<string, unknown> | null;
    actionResult?: { success: boolean; message: string } | null;
  },
): Promise<void> {
  const { error } = await supabase.from("coach_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    role: msg.role,
    content: msg.content,
    action: msg.action ?? null,
    action_data: msg.actionData ?? null,
    action_result: msg.actionResult ?? null,
  });

  if (error) {
    console.error("[conversation] Failed to save message:", error.message);
  }

  // Touch conversation updated_at
  await supabase
    .from("coach_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);
}

/**
 * Load messages for a conversation with cursor-based pagination.
 */
export async function loadConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit = 50,
  before?: string,
): Promise<MessageRow[]> {
  let query = supabase
    .from("coach_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[conversation] Failed to load messages:", error.message);
    return [];
  }
  return (data ?? []) as MessageRow[];
}

/**
 * Get the latest conversation for a user (id + message count).
 */
export async function getLatestConversation(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ id: string; messageCount: number; updatedAt: string } | null> {
  const { data: conv } = await supabase
    .from("coach_conversations")
    .select("id, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();

  if (!conv) return null;

  const age = Date.now() - new Date(conv.updated_at).getTime();
  if (age >= CONVERSATION_GAP_MS) return null;

  const { count } = await supabase
    .from("coach_messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conv.id);

  return {
    id: conv.id,
    messageCount: count ?? 0,
    updatedAt: conv.updated_at,
  };
}
