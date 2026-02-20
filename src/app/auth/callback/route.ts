import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Ensure profile exists after OAuth login
      try {
        await fetch(`${origin}/api/auth/ensure-profile`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (ensureError) {
        console.warn("Failed to ensure profile after OAuth:", ensureError);
      }

      // Redirect to onboarding if needed, otherwise dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
}
