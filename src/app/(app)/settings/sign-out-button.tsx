"use client";

import type { ComponentProps } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  label?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  className?: string;
};

export function SignOutButton({
  label = "Sign Out",
  variant = "destructive",
  className,
}: SignOutButtonProps = {}) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      toast.error(error.message);
      return;
    }

    // Clear onboarding cache cookie so the next user gets the onboarding flow
    document.cookie = "fh_onboarded=; path=/; max-age=0";

    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleSignOut}
      className={className}
    >
      <LogOut className="mr-2 size-4" />
      {label}
    </Button>
  );
}
