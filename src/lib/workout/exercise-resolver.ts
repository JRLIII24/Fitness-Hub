import type { Exercise } from "@/types/workout";
import { MUSCLE_GROUPS } from "@/lib/constants";

type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const DB_ALLOWED_EQUIPMENT = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "bodyweight",
  "band",
]);

export function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: string; message?: string; details?: string };
  const text = `${candidate.message ?? ""} ${candidate.details ?? ""}`.toLowerCase();

  return (
    candidate.code === "PGRST205" ||
    text.includes("could not find the table") ||
    text.includes("relation") && text.includes("does not exist")
  );
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeEquipment(equipment: string | null): string {
  if (!equipment) return "bodyweight";
  return DB_ALLOWED_EQUIPMENT.has(equipment) ? equipment : "bodyweight";
}

export function resolveExerciseMediaUrl(
  mediaUrl: string | null | undefined,
  source?: string | null
): string | null {
  if (!mediaUrl) return null;
  const trimmed = mediaUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice("http://".length)}`;
  if (trimmed.startsWith("https://")) return trimmed;

  if (source === "free-exercise-db") {
    const clean = trimmed.replace(/^\/+/, "");
    return `https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/${clean}`;
  }

  return null;
}

export function makeCustomExercise(name: string, muscleGroup: MuscleGroup, equipment: string): Exercise {
  const slugBase = slugify(name);
  return {
    id: `custom-${slugBase}-${Date.now()}`,
    name,
    slug: `${slugBase}-${muscleGroup}`,
    muscle_group: muscleGroup,
    equipment,
    category: "isolation",
    instructions: null,
    form_tips: null,
    image_url: null,
  };
}
