import { z } from 'zod';

export const launcherStartSchema = z.object({
    template_id: z.string().optional().nullable(),
    accepted: z.boolean(),
    time_to_decision_ms: z.number().int().nonnegative().optional(),
    chosen_alternative_id: z.string().optional().nullable(),
    reason: z.string().optional().nullable(),
}).strict(); // strict rejects unexpected keys

// For potential future use
export const baseWorkoutSchema = z.object({
    workout_id: z.string().uuid(),
    name: z.string(),
    started_at: z.string().datetime(),
});
