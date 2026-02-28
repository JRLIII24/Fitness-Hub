import { z } from "zod";

export const submitReviewSchema = z.object({
  rating: z.number().int("Rating must be a whole number").min(1, "Minimum rating is 1").max(5, "Maximum rating is 5"),
  comment: z.string().max(500, "Comment must be 500 characters or less").optional(),
}).strict();

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;
