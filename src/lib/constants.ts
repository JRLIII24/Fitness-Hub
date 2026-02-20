export const MUSCLE_GROUPS = [
  "chest",
  "back",
  "legs",
  "shoulders",
  "arms",
  "core",
  "full_body",
] as const;

export const EQUIPMENT_TYPES = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "bodyweight",
  "band",
] as const;

export const EXERCISE_CATEGORIES = [
  "compound",
  "isolation",
  "cardio",
  "stretch",
] as const;

export const SET_TYPES = [
  "warmup",
  "working",
  "dropset",
  "failure",
] as const;

export const MEAL_TYPES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
] as const;

export const REST_PRESETS = [30, 60, 90, 120, 180] as const;

export const MACRO_COLORS = {
  protein: "text-blue-400",
  carbs: "text-yellow-400",
  fat: "text-pink-400",
  fiber: "text-green-400",
} as const;

export const MUSCLE_GROUP_LABELS: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  legs: "Legs",
  shoulders: "Shoulders",
  arms: "Arms",
  core: "Core",
  full_body: "Full Body",
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  kettlebell: "Kettlebell",
  cable: "Cable",
  machine: "Machine",
  bodyweight: "Bodyweight",
  band: "Resistance Band",
};
