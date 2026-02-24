import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export type ExportRow = {
    // Session details
    session_id: string;
    session_name: string;
    session_status: string;
    session_started_at: string;
    session_completed_at: string | null;
    session_duration_seconds: number | null;
    session_rpe: number | null;
    session_notes: string | null;
    session_total_volume_kg: number | null;

    // Set details
    set_id: string | null;
    exercise_id: string | null;
    set_number: number | null;
    set_type: string | null;
    reps: number | null;
    weight_kg: number | null;
    set_duration_seconds: number | null;
    set_rpe: number | null;
    set_rir: number | null;
    set_rest_seconds: number | null;
    set_completed_at: string | null;
    set_notes: string | null;
};

export async function* streamUserWorkoutData(
    supabase: SupabaseClient<Database>,
    userId: string,
    batchSize: number = 50,
    startDate?: string,
    endDate?: string
): AsyncGenerator<ExportRow[]> {
    let offset = 0;
    let hasMoreSessions = true;

    while (hasMoreSessions) {
        let query = supabase
            .from('workout_sessions')
            .select(`
                id, name, status, started_at, completed_at, duration_seconds, session_rpe, notes, total_volume_kg
            `)
            .eq('user_id', userId);

        if (startDate) {
            query = query.gte('started_at', startDate);
        }
        if (endDate) {
            query = query.lte('started_at', endDate);
        }

        const { data: sessionsData, error: sessionError } = await query
            .order('started_at', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + batchSize - 1);

        if (sessionError) {
            throw new Error(`Failed to fetch workout sessions: ${sessionError.message}`);
        }

        const sessions = sessionsData as any[] | null;

        if (!sessions || sessions.length === 0) {
            hasMoreSessions = false;
            break;
        }

        const sessionIds = sessions.map(s => s.id);

        // Fetch sets for these sessions
        const { data: setsData, error: setsError } = await supabase
            .from('workout_sets')
            .select(`
                id, session_id, exercise_id, set_number, set_type, reps, weight_kg, duration_seconds, rpe, rir, rest_seconds, completed_at, notes
            `)
            .in('session_id', sessionIds)
            .order('session_id', { ascending: true })
            .order('sort_order', { ascending: true });

        if (setsError) {
            throw new Error(`Failed to fetch workout sets: ${setsError.message}`);
        }

        const sets = setsData as any[] | null;

        const setsBySessionId = new Map<string, any[]>();
        if (sets) {
            for (const set of sets) {
                const sessionSets = setsBySessionId.get(set.session_id) || [];
                sessionSets.push(set);
                setsBySessionId.set(set.session_id, sessionSets);
            }
        }

        const flatBatch: ExportRow[] = [];

        for (const session of sessions) {
            const sessionSets = setsBySessionId.get(session.id);
            if (!sessionSets || sessionSets.length === 0) {
                flatBatch.push({
                    session_id: session.id,
                    session_name: session.name,
                    session_status: session.status,
                    session_started_at: session.started_at,
                    session_completed_at: session.completed_at,
                    session_duration_seconds: session.duration_seconds,
                    session_rpe: session.session_rpe,
                    session_notes: session.notes,
                    session_total_volume_kg: session.total_volume_kg,

                    set_id: null,
                    exercise_id: null,
                    set_number: null,
                    set_type: null,
                    reps: null,
                    weight_kg: null,
                    set_duration_seconds: null,
                    set_rpe: null,
                    set_rir: null,
                    set_rest_seconds: null,
                    set_completed_at: null,
                    set_notes: null,
                });
            } else {
                for (const set of sessionSets) {
                    flatBatch.push({
                        session_id: session.id,
                        session_name: session.name,
                        session_status: session.status,
                        session_started_at: session.started_at,
                        session_completed_at: session.completed_at,
                        session_duration_seconds: session.duration_seconds,
                        session_rpe: session.session_rpe,
                        session_notes: session.notes,
                        session_total_volume_kg: session.total_volume_kg,

                        set_id: set.id,
                        exercise_id: set.exercise_id,
                        set_number: set.set_number,
                        set_type: set.set_type,
                        reps: set.reps,
                        weight_kg: set.weight_kg,
                        set_duration_seconds: set.duration_seconds,
                        set_rpe: set.rpe,
                        set_rir: set.rir,
                        set_rest_seconds: set.rest_seconds,
                        set_completed_at: set.completed_at,
                        set_notes: set.notes,
                    });
                }
            }
        }

        yield flatBatch;

        if (sessions.length < batchSize) {
            hasMoreSessions = false;
        } else {
            offset += batchSize;
        }
    }
}
