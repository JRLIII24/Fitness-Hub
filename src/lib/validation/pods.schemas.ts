import { z } from "zod";

export const createPodSchema = z.object({
  name: z.string().min(2, "Pod name must be at least 2 characters")
    .max(50, "Pod name must be 50 characters or less")
    .trim(),
  description: z.string().max(200, "Description must be 200 characters or less").optional(),
}).strict();

export type CreatePodInput = z.infer<typeof createPodSchema>;
