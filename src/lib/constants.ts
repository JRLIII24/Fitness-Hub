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
  "smith_machine",
  "bodyweight",
  "band",
] as const;

export const EXERCISE_CATEGORIES = [
  "compound",
  "isolation",
  "cardio",
  "stretch",
] as const;

export const WORKOUT_TYPES = [
  "strength",
  "hypertrophy",
  "endurance",
  "powerlifting",
  "cardio",
  "mobility",
  "custom",
] as const;

export const WORKOUT_TYPE_LABELS: Record<string, string> = {
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  endurance: "Endurance",
  powerlifting: "Powerlifting",
  cardio: "Cardio",
  mobility: "Mobility",
  custom: "Custom",
};

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
  protein: "text-[var(--macro-protein)]",
  carbs: "text-[var(--macro-carbs)]",
  fat: "text-[var(--macro-fat)]",
  fiber: "text-[var(--macro-fiber)]",
} as const;

export const MACRO_BG_COLORS = {
  protein: "bg-[var(--macro-protein)]",
  carbs: "bg-[var(--macro-carbs)]",
  fat: "bg-[var(--macro-fat)]",
  fiber: "bg-[var(--macro-fiber)]",
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
  smith_machine: "Smith Machine",
  bodyweight: "Bodyweight",
  band: "Resistance Band",
};
