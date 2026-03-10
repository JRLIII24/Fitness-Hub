import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { ProgramDetailClient } from "./program-detail-client";

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: program } = await supabase
    .from("training_programs")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!program) notFound();

  // program_data is JSONB in Supabase (typed as Json); cast through unknown
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ProgramDetailClient program={program as any} />;
}
