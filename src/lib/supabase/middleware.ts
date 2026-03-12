import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Allow unauthenticated access to auth and password reset pages
  const isPublicPath =
    request.nextUrl.pathname === "/" ||
    request.nextUrl.pathname === "/manifest.json" ||
    request.nextUrl.pathname.startsWith("/login") ||
    request.nextUrl.pathname.startsWith("/signup") ||
    request.nextUrl.pathname.startsWith("/forgot-password") ||
    request.nextUrl.pathname.startsWith("/reset-password");

  // Protected routes — redirect to login if not authenticated
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    // Clear stale onboarding cookie so the next user gets the onboarding flow
    response.cookies.set("fh_onboarded", "", { path: "/", maxAge: 0 });
    return response;
  }

  // Clear stale onboarding cookie when no user is signed in
  if (!user && request.cookies.get("fh_onboarded")?.value) {
    supabaseResponse.cookies.set("fh_onboarded", "", { path: "/", maxAge: 0 });
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (request.nextUrl.pathname.startsWith("/login") ||
      request.nextUrl.pathname.startsWith("/signup"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Handle onboarding flow for authenticated users
  if (user) {
    const onboardedCookie = request.cookies.get("fh_onboarded")?.value;
    const isOnOnboardingPage = request.nextUrl.pathname.startsWith("/onboarding");

    // If cookie confirms onboarding is done, skip the profile query entirely
    if (onboardedCookie === "1") {
      return supabaseResponse;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    const isApiPath = request.nextUrl.pathname.startsWith("/api/");
    const profileMissing = !profile && !profileError;

    if (profileError && process.env.NODE_ENV !== "production") {
      console.warn("Profile lookup warning in middleware:", profileError);
    }

    // Redirect to onboarding if profile is missing or onboarding not completed
    // (except when already on onboarding page or hitting API endpoints).
    if (
      !isApiPath &&
      !isOnOnboardingPage &&
      (profileMissing || (profile && !profile.onboarding_completed))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Redirect away from onboarding if already completed
    if (profile?.onboarding_completed && isOnOnboardingPage) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }

    // Cache onboarding status to skip future profile queries
    if (profile?.onboarding_completed) {
      supabaseResponse.cookies.set("fh_onboarded", "1", {
        maxAge: 3600,
        path: "/",
        sameSite: "lax" as const,
        secure: process.env.NODE_ENV === "production",
        httpOnly: true,
      });
    }
  }

  return supabaseResponse;
}
