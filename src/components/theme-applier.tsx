"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAccentColor } from "@/hooks/use-accent-color";

export function ThemeApplier() {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
    });
  }, []);

  const { appTheme } = useAppTheme(userId);
  useAccentColor(appTheme === "custom", userId);

  return null;
}
