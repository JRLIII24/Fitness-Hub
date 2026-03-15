"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirect to the unified Command Center at /social */
export default function PodsRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/social");
  }, [router]);

  return null;
}
