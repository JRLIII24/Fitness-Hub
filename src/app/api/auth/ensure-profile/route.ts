import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        "Missing Supabase env vars for ensure-profile route",
        {
          hasSupabaseUrl: Boolean(supabaseUrl),
          hasServiceRoleKey: Boolean(serviceRoleKey),
        }
      );
      return Response.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    // Service role client with full privileges.
    // Lazily initialize in-handler to avoid build-time crashes when env vars are absent.
    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Optional body parse for backward compatibility with old callers.
    // The API no longer trusts client-provided user IDs.
    await request
      .json()
      .catch(() => null);

    // Call with the authenticated caller's ID only.
    const { error } = await supabaseAdmin.rpc("ensure_user_profile", {
      user_id: user.id,
    });

    if (error) {
      console.error("Error ensuring user profile:", error);
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("Unexpected error:", err);
    return Response.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
