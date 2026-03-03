import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { logger } from '@/lib/logger';
import type { ChallengeLeaderboard } from '@/types/pods';

interface UsePodLeaderboard {
    leaderboards: {
        volume: ChallengeLeaderboard | null;
        consistency: ChallengeLeaderboard | null;
    };
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export function usePodLeaderboard(podId: string): UsePodLeaderboard {
    const supabase = useMemo(() => createClient(), []);
    const [leaderboards, setLeaderboards] = useState<UsePodLeaderboard['leaderboards']>({
        volume: null,
        consistency: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboards = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await fetch(`/api/pods/${podId}/leaderboards`);

            if (!res.ok) {
                if (res.status === 404) {
                    setLeaderboards({ volume: null, consistency: null });
                    return;
                }
                throw new Error('Failed to load leaderboards');
            }

            const data = await res.json();

            if (data.leaderboards) {
                const sorted: UsePodLeaderboard['leaderboards'] = {
                    volume: data.leaderboards.find((l: ChallengeLeaderboard) => l.challenge.challenge_type === 'volume') || null,
                    consistency: data.leaderboards.find((l: ChallengeLeaderboard) => l.challenge.challenge_type === 'consistency') || null,
                };
                setLeaderboards(sorted);
            }
        } catch (err) {
            logger.error('Fetch pod leaderboards error:', err);
            setError(err instanceof Error ? err.message : 'Failed to load leaderboards');
        } finally {
            setLoading(false);
        }
    }, [podId]);

    useEffect(() => {
        if (podId) {
            fetchLeaderboards();
        }
    }, [podId, fetchLeaderboards]);

    // Listen for new completed workouts which affect leaderboards.
    useEffect(() => {
        if (!podId) return;

        const workoutsSubscription = supabase
            .channel(`pod_workouts_${podId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'workout_sessions' },
                () => {
                    fetchLeaderboards();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(workoutsSubscription);
        };
    }, [podId, supabase, fetchLeaderboards]);

    return { leaderboards, loading, error, refetch: fetchLeaderboards };
}
