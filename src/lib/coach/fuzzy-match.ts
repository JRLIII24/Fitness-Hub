/**
 * Fuzzy exercise name matching — replaces basic includes() matching
 * with Levenshtein distance + multi-strategy scoring.
 */

/** Compute Levenshtein edit distance between two strings */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[m][n];
}

/**
 * Score a query against a candidate string (0-1, higher = better match).
 * Uses multiple strategies: exact, starts-with, includes, Levenshtein ratio.
 */
export function normalizedScore(query: string, candidate: string): number {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();

  if (q === c) return 1.0;
  if (c.startsWith(q) || q.startsWith(c)) return 0.9;
  if (c.includes(q) || q.includes(c)) return 0.8;

  // Word-level matching: "bench press" matches "Barbell Bench Press"
  const qWords = q.split(/\s+/);
  const cWords = c.split(/\s+/);
  const matchedWords = qWords.filter((w) =>
    cWords.some((cw) => cw.includes(w) || w.includes(cw)),
  );
  if (matchedWords.length > 0 && matchedWords.length >= qWords.length * 0.5) {
    return 0.6 + (matchedWords.length / qWords.length) * 0.2;
  }

  // Levenshtein ratio
  const dist = levenshtein(q, c);
  const maxLen = Math.max(q.length, c.length);
  if (maxLen === 0) return 0;
  const ratio = 1 - dist / maxLen;
  return Math.max(0, ratio);
}

/**
 * Find the best-matching exercise index in a workout by fuzzy name matching.
 * Returns -1 if no match above threshold (0.5).
 */
export function fuzzyFindExerciseIndex(
  exercises: Array<{ exercise: { name: string } }>,
  query: string,
  threshold = 0.5,
): number {
  if (!exercises.length || !query) return -1;

  let bestIdx = -1;
  let bestScore = threshold;

  for (let i = 0; i < exercises.length; i++) {
    const score = normalizedScore(query, exercises[i].exercise.name);
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  return bestIdx;
}
