import { z } from "zod";

const scoreField = z.number().int().min(0).max(10);

export const fatigueCheckinSchema = z
  .object({
    timezone: z.string().min(1).max(100).optional(),
    sleep_quality: scoreField,
    soreness: scoreField,
    stress: scoreField,
    motivation: scoreField,
    notes: z.string().max(500).optional().nullable(),
  })
  .strict();

export const fatigueSessionRpeSchema = z
  .object({
    session_id: z.string().uuid(),
    session_rpe: z.number().min(0).max(10),
    timezone: z.string().min(1).max(100).optional(),
  })
  .strict();
