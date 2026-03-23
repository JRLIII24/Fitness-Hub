import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCoachMemories, deleteCoachMemory } from "@/lib/coach/memory";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memories = await getCoachMemories(supabase, user.id);

  // Group by category
  const grouped: Record<string, typeof memories> = {};
  for (const m of memories) {
    if (!grouped[m.category]) grouped[m.category] = [];
    grouped[m.category].push(m);
  }

  return NextResponse.json({ memories, grouped });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "Missing memory id" }, { status: 400 });
  }

  const ok = await deleteCoachMemory(supabase, user.id, body.id);
  if (!ok) {
    return NextResponse.json(
      { error: "Failed to delete memory" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
