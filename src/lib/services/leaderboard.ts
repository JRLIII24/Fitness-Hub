import { unstable_cache, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/**
 * Leaderboard Service
 * 
 * Provides server-side data fetching for pod leaderboards.
 * 
 * Caching Strategy:
 * - Uses Next.js unstable_cache to wrap direct database queries.
 * - Cache tags: ['leaderboard', podId] or just ['leaderboard'] for global scopes.
 * - Revalidation: Cache is manually invalidated when new sessions (workouts/runs) are
 *   completed using revalidateLeaderboard(podId).
 * - Fallback TTL: 60 seconds backup revalidation in case an invalidation event is missed.
 */

interface GetLeaderboardOptions {
    podId: string;
}

export const getLeaderboardRankings = unstable_cache(
    async ({ podId }: GetLeaderboardOptions) => {
        const supabase = await createClient();

        // Call the PostgreSQL function get_challenge_leaderboards 
        // This assumes `get_challenge_leaderboards` function exists in DB
        const { data: leaderboards, error } = await (supabase as any)
            .rpc('get_challenge_leaderboards', { p_pod_id: podId });

        if (error) {
            console.error('Error fetching leaderboard rankings:', error);
            throw error;
        }

        return leaderboards || [];
    },
    // Cache key parts
    ['leaderboard-rankings'],
    {
        revalidate: 60, // 60 seconds fallback 
        tags: ['leaderboard']
    }
);

/**
 * Triggers revalidation of the leaderboard cache.
 * Should be called whenever a user completes a workout, run, or modifies a challenge.
 * 
 * @param podId Optional pod ID to invalidate specific pod leaderboards in future
 */
export async function revalidateLeaderboard(podId?: string) {
    // Invalidate the generic 'leaderboard' tag 
    // @ts-expect-error type discrepancy in next cache
    revalidateTag('leaderboard');

    if (podId) {
        // @ts-expect-error type discrepancy in next cache
        revalidateTag(`leaderboard-${podId}`);
    }
}
