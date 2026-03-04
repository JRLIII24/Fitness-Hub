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
    label: "Upper Body Strength",
    defaultName: "Upper Body Strength",
    category: "chest",
    lifts: [
      { name: "Barbell Bench Press", sets: 4, reps: "8" },
      { name: "Barbell Bent-Over Row", sets: 4, reps: "8" },
      { name: "Seated Dumbbell Press", sets: 3, reps: "10" },
      { name: "Lat Pulldown (Wide Grip)", sets: 3, reps: "10" },
      { name: "Close-Grip Bench Press", sets: 3, reps: "10" },
      { name: "EZ-Bar Curl", sets: 3, reps: "12" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "push-day",
    label: "Push Day (Chest/Shoulders/Triceps)",
    defaultName: "Push Day",
    category: "chest",
    lifts: [
      { name: "Incline Barbell Bench Press", sets: 4, reps: "8" },
      { name: "Seated Chest Press Machine", sets: 3, reps: "10" },
      { name: "Arnold Press", sets: 3, reps: "10" },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "15" },
      { name: "Rope Pushdown", sets: 3, reps: "12" },
      { name: "Overhead Dumbbell Extension", sets: 3, reps: "12" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "pull-day",
    label: "Pull Day (Back/Biceps)",
    defaultName: "Pull Day",
    category: "back",
    lifts: [
      { name: "Conventional Deadlift", sets: 4, reps: "5" },
      { name: "Weighted Pull-Ups", sets: 4, reps: "8" },
      { name: "Seated Cable Row", sets: 3, reps: "10" },
      { name: "Face Pulls", sets: 3, reps: "15" },
      { name: "Hammer Curl", sets: 3, reps: "12" },
      { name: "Cable Curl", sets: 3, reps: "12" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "leg-day",
    label: "Leg Day (Quads/Glutes/Hams)",
    defaultName: "Leg Day",
    category: "legs",
    lifts: [
      { name: "Barbell Back Squat", sets: 4, reps: "6" },
      { name: "Leg Press", sets: 4, reps: "10" },
      { name: "Romanian Deadlift", sets: 3, reps: "10" },
      { name: "Bulgarian Split Squat", sets: 3, reps: "10" },
      { name: "Leg Extension", sets: 3, reps: "12" },
      { name: "Seated Leg Curl", sets: 3, reps: "12" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "full-body",
    label: "Full Body Compound",
    defaultName: "Full Body",
    category: "full body",
    lifts: [
      { name: "Trap Bar Deadlift", sets: 4, reps: "6" },
      { name: "Barbell Bench Press", sets: 4, reps: "8" },
      { name: "Barbell Bent-Over Row", sets: 4, reps: "8" },
      { name: "Barbell Overhead Press", sets: 3, reps: "8" },
      { name: "Farmer's Carry", sets: 3, reps: "1" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
  {
    id: "arms-shoulders",
    label: "Arms + Delts",
    defaultName: "Arms & Delts",
    category: "arms",
    lifts: [
      { name: "EZ-Bar Curl", sets: 3, reps: "10" },
      { name: "Incline Dumbbell Curl", sets: 3, reps: "12" },
      { name: "Rope Pushdown", sets: 3, reps: "12" },
      { name: "Skull Crushers", sets: 3, reps: "10" },
      { name: "Dumbbell Lateral Raise", sets: 3, reps: "15" },
      { name: "Rear Delt Fly", sets: 3, reps: "15" },
    ],
    get liftNames() { return this.lifts.map(l => l.name); },
  },
];
