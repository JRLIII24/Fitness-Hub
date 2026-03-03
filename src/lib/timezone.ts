import { createClient } from "@/lib/supabase/server";

export function getDateInTimezone(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function toDayKeyInTimezone(value: string, timezone: string): string {
  return getDateInTimezone(new Date(value), timezone);
}

/**
 * Get user's timezone from their profile, fallback to UTC.
 * Uses the existing profiles.timezone column.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", userId)
    .maybeSingle();
  return data?.timezone || "UTC";
}

/**
 * Get the start and end of "today" in the user's timezone as ISO strings.
 */
export function getDayBoundaries(timezone: string): { dayStart: string; dayEnd: string; todayStr: string } {
  const now = new Date();
  const todayStr = getDateInTimezone(now, timezone);

  return { dayStart: `${todayStr}T00:00:00`, dayEnd: `${todayStr}T23:59:59.999`, todayStr };
}

/**
 * Get the current hour in the user's timezone (0-23).
 */
export function getHourInTimezone(timezone: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date()),
    10,
  );
}
