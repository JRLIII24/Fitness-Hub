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
  const publicPaths = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
  ];
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Protected routes — redirect to login if not authenticated
  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
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
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();

    const isOnOnboardingPage = request.nextUrl.pathname.startsWith("/onboarding");
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
  }

  return supabaseResponse;
}
