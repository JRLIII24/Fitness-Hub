"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { AppTheme } from "@/hooks/use-app-theme";

const COLOR_THEMES: { value: AppTheme; label: string; subtitle: string; preview: string }[] = [
  {
    value: "default",
    label: "Classic",
    subtitle: "Clean white & black",
    preview: "#f4f4f5",
  },
  {
    value: "pink",
    label: "Pink",
    subtitle: "Bold pink accent",
    preview: "#ff4f9f",
  },
  {
    value: "blue",
    label: "Blue",
    subtitle: "Electric blue accent",
    preview: "#3e8bff",
  },
  {
    value: "custom",
    label: "Custom",
    subtitle: "Pick your own accent",
    preview: "#22c55e",
  },
];

const STORAGE_KEY = "fithub-color-theme";
const ACCENT_STORAGE_KEY = "fithub-accent-color";

function isSafariBrowser() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg|OPR/i.test(ua);
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>("default");
  const [customAccent, setCustomAccent] = useState("#22c55e");
  const [loading, setLoading] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    setIsSafari(isSafariBrowser());
  }, []);

  const availableThemes = isSafari
    ? COLOR_THEMES.filter((t) => t.value === "default" || t.value === "custom")
    : COLOR_THEMES;

  function handleNext(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setStep(2);
  }

  async function handleCreateAccount() {
    setLoading(true);

    // Persist to localStorage so ThemeApplier can apply it instantly on first load
    localStorage.setItem(STORAGE_KEY, selectedTheme);
    if (selectedTheme === "custom") {
      localStorage.setItem(ACCENT_STORAGE_KEY, customAccent);
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          theme_preference: selectedTheme,
        },
        emailRedirectTo: `${window.location.origin}/login`,
      },
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    toast.success("Account created! Check your email to confirm your account.");
    router.push("/login");
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">
          {step === 1 ? "Create your account" : "Choose your theme"}
        </CardTitle>
        <CardDescription>
          {step === 1
            ? "Start tracking your fitness journey with FitHub"
            : "Pick a color style — you can change this anytime in Settings"}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {step === 1 ? (
          <form onSubmit={handleNext} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                type="text"
                placeholder="Your name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                autoComplete="name"
              />
            </div>
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
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Min. 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full">
              Next →
            </Button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className={`grid gap-3 ${isSafari ? "grid-cols-2" : "grid-cols-4"}`}>
              {availableThemes.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSelectedTheme(opt.value)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all ${
                    selectedTheme === opt.value
                      ? "border-primary bg-primary/10 scale-[1.04]"
                      : "border-border/60 hover:bg-accent"
                  }`}
                >
                  <span
                    className="size-10 rounded-full border border-border/30"
                    style={{ background: opt.preview }}
                  />
                  <span className="font-semibold text-sm leading-tight">{opt.label}</span>
                  <span className="text-xs text-muted-foreground leading-tight">{opt.subtitle}</span>
                </button>
              ))}
            </div>

            {selectedTheme === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-accent">Custom Accent Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="custom-accent"
                    type="color"
                    value={customAccent}
                    onChange={(e) => setCustomAccent(e.target.value)}
                    className="h-10 w-16 cursor-pointer p-1"
                  />
                  <Input value={customAccent} readOnly className="font-mono text-xs" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                ← Back
              </Button>
              <Button className="flex-1" onClick={handleCreateAccount} disabled={loading}>
                {loading ? "Creating account…" : "Create Account"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
