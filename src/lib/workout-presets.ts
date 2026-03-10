export type WorkoutPresetId =
  | "upper-body-strength"
  | "push-day"
  | "pull-day"
  | "leg-day"
  | "full-body"
  | "arms-shoulders"
  | "custom";

export type PresetLift = { name: string; sets: number; reps: string };

export type WorkoutPreset = {
  id: Exclude<WorkoutPresetId, "custom">;
  label: string;
  defaultName: string;
  category: string;
  lifts: PresetLift[];
  /** Derived for display -- kept in sync with lifts */
  liftNames: string[];
};

export const POPULAR_WORKOUTS: WorkoutPreset[] = [
  {
    id: "upper-body-strength",
    label: "The Full-Stack Torso Protocol",
    defaultName: "Upper Body Strength",
    category: "chest",
    lifts: [
      { name: "Barbell Bench Press", sets: 4, reps: "8" },
      { name: "Lat Pulldown (Wide Grip)", sets: 4, reps: "10" },
      { name: "Seated Dumbbell Press", sets: 3, reps: "10" },
      { name: "Seated Cable Row", sets: 3, reps: "12" },
      { name: "Incline Dumbbell Fly", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "push-day",
    label: "The Front-End Force Routine",
    defaultName: "Push Day",
    category: "chest",
    lifts: [
      { name: "Incline Barbell Bench Press", sets: 4, reps: "8" },
      { name: "Dumbbell Bench Press", sets: 3, reps: "10" },
      { name: "Arnold Press", sets: 3, reps: "10" },
      { name: "Cable Lateral Raise", sets: 4, reps: "15" },
      { name: "Rope Pushdown", sets: 3, reps: "12" },
      { name: "Overhead Dumbbell Extension", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "pull-day",
    label: "The Server Rack Masterclass",
    defaultName: "Pull Day",
    category: "back",
    lifts: [
      { name: "Conventional Deadlift", sets: 3, reps: "6" },
      { name: "Weighted Pull-Ups", sets: 4, reps: "8" },
      { name: "Chest-Supported Dumbbell Row", sets: 3, reps: "10" },
      { name: "Reverse Pec Deck", sets: 3, reps: "15" },
      { name: "Alternating Dumbbell Curl", sets: 3, reps: "12" },
      { name: "Preacher Curl", sets: 3, reps: "12" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "leg-day",
    label: "The Resilient Foundation Framework",
    defaultName: "Leg Day",
    category: "legs",
    lifts: [
      { name: "Barbell Back Squat", sets: 4, reps: "8" },
      { name: "Romanian Deadlift", sets: 4, reps: "10" },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10" },
      { name: "Seated Leg Curl", sets: 3, reps: "15" },
      { name: "Standing Calf Raises", sets: 4, reps: "15" },
      { name: "Seated Calf Raises", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "full-body",
    label: "The InsightLayer Integration",
    defaultName: "Full Body",
    category: "full body",
    lifts: [
      { name: "Trap Bar Deadlift", sets: 4, reps: "6" },
      { name: "Goblet Squat", sets: 3, reps: "12" },
      { name: "Weighted Dips", sets: 3, reps: "10" },
      { name: "Pull-Ups", sets: 3, reps: "8" },
      { name: "Seated Dumbbell Press", sets: 3, reps: "10" },
      { name: "Hanging Leg Raises", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "arms-shoulders",
    label: "The Fit-Hub Extension Module",
    defaultName: "Arms & Delts",
    category: "arms",
    lifts: [
      { name: "Barbell Overhead Press", sets: 4, reps: "8" },
      { name: "Cable Lateral Raise", sets: 4, reps: "15" },
      { name: "Face Pulls", sets: 3, reps: "15" },
      { name: "Barbell Curl", sets: 3, reps: "10" },
      { name: "Skull Crushers", sets: 3, reps: "10" },
      { name: "Hammer Curl", sets: 3, reps: "12" },
      { name: "Triceps Kickbacks", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
];
