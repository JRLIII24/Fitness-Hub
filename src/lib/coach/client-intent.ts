/**
 * Client-side intent detection for the AI coach.
 * Catches simple messages (greetings, thanks, affirmations) before they hit the API,
 * saving a Sonnet call. Returns a canned response string, or null if the message
 * should be forwarded to the AI.
 */

const GREETING = /^(hey|hi|hello|sup|yo|what'?s up|howdy|hiya)\b/i;
const THANKS = /^(thanks|thank you|thx|ty|cheers|appreciate it)\b/i;
const AFFIRMATION = /^(ok|okay|k|got it|cool|nice|sounds good|alright|perfect|great|bet|word|aight)\s*[.!]?\s*$/i;

const GREETING_RESPONSES = [
  "Hey! What can I help you with today?",
  "What's up! Ready to crush this workout?",
  "Hey there! Need coaching advice or help with your workout?",
];

const THANKS_RESPONSES = [
  "You're welcome! Let me know if you need anything else.",
  "Anytime! Keep pushing — you've got this.",
  "No problem! I'm here if you need me.",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Detect simple intents that don't need an AI call.
 * @returns A canned response string, or `null` if the message should go to the API.
 */
export function detectSimpleIntent(message: string): string | null {
  const trimmed = message.trim();

  // Skip anything longer than ~40 chars — likely a real question
  if (trimmed.length > 40) return null;

  if (GREETING.test(trimmed)) return pick(GREETING_RESPONSES);
  if (THANKS.test(trimmed)) return pick(THANKS_RESPONSES);

  // Affirmations get no response (acknowledged silently)
  if (AFFIRMATION.test(trimmed)) return "";

  return null;
}
