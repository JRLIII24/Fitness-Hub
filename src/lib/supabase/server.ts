import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// To enable full type safety, link your Supabase project and run:
//   pnpm gen:types
// Then replace <any> with <Database> from "@/types/database"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                sameSite: "lax" as const,
                secure: process.env.NODE_ENV === "production",
                httpOnly: true,
                path: "/",
              })
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
