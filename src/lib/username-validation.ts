import { createClient } from "@/lib/supabase/client";

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates username format and checks availability
 */
export async function validateUsername(
  username: string,
  currentUserId?: string
): Promise<UsernameValidationResult> {
  // Format validation
  if (!username || username.length < 3) {
    return {
      isValid: false,
      error: "Username must be at least 3 characters",
    };
  }

  if (username.length > 30) {
    return {
      isValid: false,
      error: "Username must be 30 characters or less",
    };
  }

  // Only allow alphanumeric, underscores, and hyphens
  const usernameRegex = /^[a-zA-Z0-9_-]+$/;
  if (!usernameRegex.test(username)) {
    return {
      isValid: false,
      error: "Username can only contain letters, numbers, underscores, and hyphens",
    };
  }

  // Check if starts with letter or number
  if (!/^[a-zA-Z0-9]/.test(username)) {
    return {
      isValid: false,
      error: "Username must start with a letter or number",
    };
  }

  // Check availability in database
  const supabase = createClient();
  const { data: existingUser, error: dbError } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (dbError) {
    return {
      isValid: false,
      error: "Unable to check username availability. Please try again.",
    };
  }

  // If user exists and it's not the current user, username is taken
  if (existingUser && existingUser.id !== currentUserId) {
    return {
      isValid: false,
      error: "This username is already taken",
    };
  }

  return { isValid: true };
}

/**
 * Reserved usernames that cannot be used (prevent brand confusion, abuse, etc.)
 */
const RESERVED_USERNAMES = [
  "admin",
  "administrator",
  "fithub",
  "fit-hub",
  "support",
  "help",
  "api",
  "www",
  "root",
  "system",
  "moderator",
  "mod",
  "official",
];

/**
 * Checks if username is in the reserved list
 */
export function isUsernameReserved(username: string): boolean {
  return RESERVED_USERNAMES.includes(username.toLowerCase());
}

/**
 * Complete validation including reserved check
 */
export async function validateUsernameComplete(
  username: string,
  currentUserId?: string
): Promise<UsernameValidationResult> {
  // Check reserved list first
  if (isUsernameReserved(username)) {
    return {
      isValid: false,
      error: "This username is reserved and cannot be used",
    };
  }

  // Then check format and availability
  return validateUsername(username, currentUserId);
}
