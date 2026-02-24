import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { ChallengeLeaderboard, PodChallenge } from '@/types/pods';

interface UsePodLeaderboard {
    leaderboards: {
        volume: ChallengeLeaderboard | null;
        consistency: ChallengeLeaderboard | null;
        distance: ChallengeLeaderboard | null;
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
        distance: null,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchLeaderboards = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            // Construct API call to fetch challenges and leaderboards for the pod
            // Assuming Claude's service will expose these via standard routes.
            // If the backend has a specific route like GET /api/pods/${podId}/leaderboards we can call it.
            // For now, we will structure it to expect an array of ChallengeLeaderboards.
            const res = await fetch(`/api/pods/${podId}/leaderboards`);

            if (!res.ok) {
                if (res.status === 404) {
                    // If no leaderboards API exists yet, just set empty. This enables frontend UI to work.
                    setLeaderboards({ volume: null, consistency: null, distance: null });
                    return;
                }
                throw new Error('Failed to load leaderboards');
            }

            const data = await res.json();

            if (data.leaderboards) {
                const sorted: UsePodLeaderboard['leaderboards'] = {
                    volume: data.leaderboards.find((l: ChallengeLeaderboard) => l.challenge.challenge_type === 'volume') || null,
                    consistency: data.leaderboards.find((l: ChallengeLeaderboard) => l.challenge.challenge_type === 'consistency') || null,
                    distance: data.leaderboards.find((l: ChallengeLeaderboard) => l.challenge.challenge_type === 'distance') || null,
                };
                setLeaderboards(sorted);
            }
        } catch (err) {
            console.error('Fetch pod leaderboards error:', err);
            // Only set error if it's not a missing implementation edge case while Claude builds the endpoint
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

    // Set up Supabase Realtime Subscriptions for event-driven updates.
    // This listens for new completed workouts/runs which affect leaderboards.
    useEffect(() => {
        if (!podId) return;

        // Listen to workout_sessions inserts/updates
        const workoutsSubscription = supabase
            .channel(`pod_workouts_${podId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'workout_sessions' },
                (payload) => {
                    console.log('[Real-Time] Workout Session changed:', payload);
                    // When a workout session changes (e.g. status goes to completed), refetch leaderboard.
                    fetchLeaderboards();
                }
            )
            .subscribe();

        // Listen to run_sessions inserts/updates  
        const runsSubscription = supabase
            .channel(`pod_runs_${podId}`)
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'run_sessions' },
                (payload) => {
                    console.log('[Real-Time] Run Session changed:', payload);
                    // When a run session changes, refetch leaderboard.
                    fetchLeaderboards();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(workoutsSubscription);
            supabase.removeChannel(runsSubscription);
        };
    }, [podId, supabase, fetchLeaderboards]);

    return { leaderboards, loading, error, refetch: fetchLeaderboards };
}
