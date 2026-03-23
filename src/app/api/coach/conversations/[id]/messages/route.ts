import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadConversationMessages } from "@/lib/coach/conversation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: conversationId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 100);
  const before = searchParams.get("before") ?? undefined;

  // Verify ownership
  const { data: conv } = await supabase
    .from("coach_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("user_id", user.id)
    .single();

  if (!conv) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const messages = await loadConversationMessages(
    supabase,
    conversationId,
    limit,
    before,
  );

  return NextResponse.json({ messages });
}
