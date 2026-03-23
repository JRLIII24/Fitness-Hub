import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const { data: conversations, error } = await supabase
    .from("coach_conversations")
    .select("id, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch first message preview for each conversation
  const enriched = await Promise.all(
    (conversations ?? []).map(async (conv) => {
      const { data: firstMsg } = await supabase
        .from("coach_messages")
        .select("content, role")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .single();

      const { count } = await supabase
        .from("coach_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conv.id);

      return {
        ...conv,
        preview: firstMsg?.content?.slice(0, 100) ?? "",
        message_count: count ?? 0,
      };
    }),
  );

  return NextResponse.json({ conversations: enriched });
}
