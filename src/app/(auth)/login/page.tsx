"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setUserNotFound(false);
    setCanResendConfirmation(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const lowerMessage = error.message.toLowerCase();

        // Check if user doesn't exist
        if (
          lowerMessage.includes("invalid login credentials") ||
          lowerMessage.includes("user not found") ||
          lowerMessage.includes("email not found")
        ) {
          setUserNotFound(true);
          toast.error("Account not found. Please sign up first.");
          return;
        }

        // Check if email not confirmed
        if (lowerMessage.includes("email not confirmed")) {
          setCanResendConfirmation(true);
          toast.error(
            "Email not confirmed. Check inbox/spam or resend confirmation below."
          );
          return;
        }

        // Generic error
        toast.error(error.message);
        if (process.env.NODE_ENV !== "production") {
          console.error("Login error:", error);
        }
        return;
      }

      try {
        await fetch("/api/auth/ensure-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
      } catch (ensureError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Failed to ensure profile after login:", ensureError);
        }
      }

      router.push("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected login failure.";
      toast.error(message);
      if (process.env.NODE_ENV !== "production") {
        console.error("Login exception:", error);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResendConfirmation() {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      toast.error(error.message);
      if (process.env.NODE_ENV !== "production") {
        console.error("Resend confirmation error:", error);
      }
      return;
    }

    toast.success("Confirmation email sent. Check inbox and spam.");
  }

  async function handleOAuthLogin(provider: "google" | "apple") {
    setOauthLoading(provider);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      toast.error(`Failed to sign in with ${provider === "google" ? "Google" : "Apple"}`);
      console.error("OAuth error:", error);
      setOauthLoading(null);
    }
    // Note: If successful, user will be redirected, so we don't clear loading state
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to your FitHub account</CardDescription>
      </CardHeader>
      <CardContent>
        {/* OAuth Providers */}
        {(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" ||
          process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true") && (
        <div className="flex flex-col gap-3 mb-4">
          {process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin("google")}
            disabled={!!oauthLoading || loading}
          >
            {oauthLoading === "google" ? (
              "Redirecting..."
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </>
            )}
          </Button>
          )}

          {process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true" && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => handleOAuthLogin("apple")}
            disabled={!!oauthLoading || loading}
          >
            {oauthLoading === "apple" ? (
              "Redirecting..."
            ) : (
              <>
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
                Continue with Apple
              </>
            )}
          </Button>
          )}
        </div>
        )}

        {(process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true" ||
          process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true") && (
        <div className="relative mb-4">
          <Separator />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
            or continue with email
          </span>
        </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link
                href="/forgot-password"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading || !!oauthLoading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
        {canResendConfirmation ? (
          <Button
            type="button"
            variant="outline"
            className="mt-3 w-full"
            onClick={handleResendConfirmation}
          >
            Resend confirmation email
          </Button>
        ) : null}
      </CardContent>
      <CardFooter className="justify-center flex-col gap-2">
        {userNotFound && (
          <div className="flex items-center gap-2 text-sm text-destructive animate-pulse mb-2">
            <Mail className="h-4 w-4" />
            <span>Account not found with this email</span>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className={`font-medium hover:underline transition-all ${
              userNotFound
                ? "text-primary ring-2 ring-primary rounded px-2 py-1 animate-pulse"
                : "text-primary"
            }`}
          >
            Sign up
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
