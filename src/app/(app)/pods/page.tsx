import { redirect } from "next/navigation";

/** Redirect to the unified Command Center at /social */
export default function PodsRedirectPage() {
  redirect("/social");
}
