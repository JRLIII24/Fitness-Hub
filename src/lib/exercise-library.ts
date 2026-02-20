import type { Exercise } from "@/types/workout";

export type MuscleGroup =
  | "chest"
  | "back"
  | "legs"
  | "shoulders"
  | "arms"
  | "core"
  | "full_body";

const EXERCISE_NAMES: Record<MuscleGroup, string[]> = {
  back: [
    "Conventional Deadlift",
    "Sumo Deadlift",
    "Trap Bar Deadlift",
    "Romanian Deadlift",
    "Rack Pull",
    "Snatch-Grip Deadlift",
    "Deficit Deadlift",
    "Weighted Pull-Ups",
    "Pull-Ups",
    "Chin-Ups",
    "Neutral-Grip Pull-Ups",
    "Wide-Grip Pull-Ups",
    "Close-Grip Pull-Ups",
    "Lat Pulldown (Wide Grip)",
    "Lat Pulldown (Close Grip)",
    "Reverse-Grip Lat Pulldown",
    "Neutral-Grip Lat Pulldown",
    "Single-Arm Lat Pulldown",
    "Straight-Arm Pulldown",
    "Meadows Row",
    "Barbell Bent-Over Row",
    "Pendlay Row",
    "Yates Row",
    "T-Bar Row",
    "Chest-Supported T-Bar Row",
    "Seated Cable Row",
    "Single-Arm Cable Row",
    "Machine Row",
    "Chest-Supported Dumbbell Row",
    "Single-Arm Dumbbell Row",
    "Inverted Rows",
    "Seal Row",
    "Landmine Row",
    "Kroc Rows",
    "Face Pulls",
    "Rear Delt Cable Row",
    "Back Extensions",
    "Reverse Hyperextensions",
    "Good Morning",
    "Superman Holds",
  ],
  legs: [
    "Barbell Back Squat",
    "Front Squat",
    "Safety Bar Squat",
    "Hack Squat (Machine)",
    "Goblet Squat",
    "Zercher Squat",
    "Smith Machine Squat",
    "Box Squat",
    "Romanian Deadlift",
    "Conventional Deadlift",
    "Sumo Deadlift",
    "Trap Bar Deadlift",
    "Good Morning",
    "Barbell Hip Thrust",
    "Single-Leg Romanian Deadlift",
    "Cable Pull-Through",
    "Walking Lunges",
    "Reverse Lunges",
    "Bulgarian Split Squat",
    "Step-Ups",
    "Lateral Lunges",
    "Deficit Lunges",
    "Leg Press",
    "Pendulum Squat",
    "Belt Squat",
    "Leg Extension",
    "Seated Leg Curl",
    "Lying Leg Curl",
    "Nordic Hamstring Curl",
    "Glute Bridge",
    "Copenhagen Adduction",
    "Tibialis Raises",
    "Standing Calf Raises",
    "Seated Calf Raises",
    "Donkey Calf Raises",
    "Jump Squats",
    "Box Jumps",
    "Kettlebell Swings",
    "Sled Push",
    "Sled Pull",
  ],
  chest: [
    "Barbell Bench Press",
    "Incline Barbell Bench Press",
    "Decline Bench Press",
    "Dumbbell Bench Press",
    "Incline Dumbbell Press",
    "Floor Press",
    "Close-Grip Bench Press",
    "Hammer Strength Chest Press",
    "Plate-Loaded Incline Press",
    "Seated Chest Press Machine",
    "Smith Machine Bench Press",
    "Pec Deck",
    "Cable Fly",
    "Low-to-High Cable Fly",
    "High-to-Low Cable Fly",
    "Dumbbell Fly",
    "Incline Dumbbell Fly",
    "Decline Dumbbell Fly",
    "Weighted Dips",
    "Chest Dips",
    "Push-Ups",
    "Weighted Push-Ups",
    "Deficit Push-Ups",
    "Ring Push-Ups",
    "Guillotine Press",
    "Spoto Press",
    "Reverse Grip Bench Press",
    "Around-the-World Dumbbell Fly",
    "Single-Arm Dumbbell Press",
    "Cable Press",
    "Medicine Ball Chest Pass",
    "Plyometric Push-Ups",
    "Explosive Bench Press",
    "Landmine Press",
    "Single-Arm Cable Press",
    "Deep Push-Ups",
    "Ring Fly",
    "Hex Press",
    "Svend Press",
    "Isometric Plate Press",
  ],
  arms: [
    "Barbell Curl",
    "EZ-Bar Curl",
    "Dumbbell Curl",
    "Alternating Dumbbell Curl",
    "Hammer Curl",
    "Incline Dumbbell Curl",
    "Preacher Curl",
    "Spider Curl",
    "Cable Curl",
    "Bayesian Curl",
    "Concentration Curl",
    "Drag Curl",
    "Reverse Curl",
    "Zottman Curl",
    "Chin-Ups",
    "Machine Biceps Curl",
    "Overhead Cable Curl",
    "Single-Arm Cable Curl",
    "Resistance Band Curl",
    "Cross-Body Hammer Curl",
    "Close-Grip Bench Press",
    "Skull Crushers",
    "EZ-Bar Triceps Extension",
    "Overhead Dumbbell Extension",
    "Rope Pushdown",
    "Straight-Bar Pushdown",
    "Cable Overhead Extension",
    "Dips",
    "Weighted Dips",
    "Machine Dip",
    "Tate Press",
    "JM Press",
    "Triceps Kickbacks",
    "Reverse Grip Pushdown",
    "Bench Dips",
    "Single-Arm Pushdown",
    "Floor Skull Crushers",
    "PJR Pullover",
    "Landmine Triceps Extension",
    "Band Pushdowns",
  ],
  shoulders: [
    "Barbell Overhead Press",
    "Seated Dumbbell Press",
    "Arnold Press",
    "Push Press",
    "Bradford Press",
    "Machine Shoulder Press",
    "Smith Machine Overhead Press",
    "Z Press",
    "Dumbbell Lateral Raise",
    "Cable Lateral Raise",
    "Lean-Away Lateral Raise",
    "Machine Lateral Raise",
    "Behind-the-Back Cable Raise",
    "Partial Lateral Raises",
    "Plate Raises",
    "Reverse Pec Deck",
    "Rear Delt Fly",
    "Chest-Supported Rear Delt Fly",
    "Face Pull",
    "High Cable Row",
    "Band Pull-Apart",
    "Dumbbell Front Raise",
    "Plate Front Raise",
    "Cable Front Raise",
    "Landmine Press",
    "Upright Row",
    "Snatch-Grip High Pull",
    "Dumbbell High Pull",
    "Bottom-Up Kettlebell Press",
    "Single-Arm Dumbbell Press",
    "External Rotations",
    "Internal Rotations",
    "Cuban Press",
    "Around-the-World Press",
    "Handstand Push-Ups",
    "Pike Push-Ups",
    "Single-Arm Landmine Press",
    "Y Raises",
    "Trap-3 Raises",
    "Scaption Raises",
  ],
  core: [
    "Ab Wheel Rollout",
    "Stability Ball Rollout",
    "Long-Lever Plank",
    "Dead Bug",
    "Hollow Hold",
    "Hanging Leg Raises",
    "Hanging Knee Raises",
    "Captain's Chair Raises",
    "Reverse Crunch",
    "Garhammer Raise",
    "Weighted Decline Sit-Ups",
    "Cable Crunch",
    "Machine Crunch",
    "Plate Sit-Ups",
    "Dumbbell Sit-Ups",
    "Cable Woodchoppers",
    "Russian Twists",
    "Landmine Rotations",
    "Medicine Ball Rotations",
    "Standing Cable Twist",
    "Pallof Press",
    "Single-Arm Farmer Carry",
    "Suitcase Carry",
    "Offset Front Carry",
    "Side Plank",
    "Copenhagen Plank",
    "Weighted Side Bend",
    "Hanging Oblique Raises",
    "Medicine Ball Slams",
    "Rotational Medicine Ball Throws",
    "Overhead Medicine Ball Throws",
    "Bird Dog",
    "Stir-the-Pot",
    "TRX Fallout",
    "Dragon Flags",
    "Toes-to-Bar",
    "L-Sit",
    "V-Ups",
    "Jackknife Sit-Ups",
    "Turkish Get-Up",
  ],
  full_body: [
    "Clean and Press",
    "Power Clean",
    "Hang Clean",
    "Squat Clean",
    "Clean Pull",
    "Snatch",
    "Hang Snatch",
    "Dumbbell Snatch",
    "Kettlebell Snatch",
    "Turkish Get-Up",
    "Thrusters (Barbell)",
    "Dumbbell Thrusters",
    "Kettlebell Thrusters",
    "Man Makers",
    "Devil's Press",
    "Burpees",
    "Burpee Pull-Ups",
    "Renegade Rows",
    "Bear Crawls",
    "Crab Walks",
    "Farmer's Carry",
    "Trap Bar Deadlift",
    "Deadlift to High Pull",
    "Barbell Complex (e.g., RDL -> Row -> Clean -> Squat -> Press)",
    "Dumbbell Complex",
    "Kettlebell Complex",
    "Sled Push",
    "Sled Pull",
    "Prowler Push",
    "Tire Flips",
    "Battle Ropes",
    "Rope Climbs",
    "Box Jump Overs",
    "Wall Balls",
    "Sandbag Cleans",
    "Sandbag Shouldering",
    "Medicine Ball Slams",
    "Medicine Ball Clean to Press",
    "Weighted Step-Ups with Press",
    "Row Erg (Indoor Rowing Machine)",
  ],
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function inferEquipment(name: string): string | null {
  const n = name.toLowerCase();

  if (n.includes("barbell") || n.includes("ez-bar") || n.includes("trap bar")) return "barbell";
  if (n.includes("dumbbell")) return "dumbbell";
  if (n.includes("kettlebell")) return "kettlebell";
  if (n.includes("cable") || n.includes("trx")) return "cable";
  if (
    n.includes("machine") ||
    n.includes("smith") ||
    n.includes("leg press") ||
    n.includes("pec deck") ||
    n.includes("sled") ||
    n.includes("prowler") ||
    n.includes("erg") ||
    n.includes("rowing")
  )
    return "machine";
  if (n.includes("band")) return "band";
  if (n.includes("bodyweight") || n.includes("push-up") || n.includes("dip") || n.includes("plank"))
    return "bodyweight";

  return null;
}

function inferCategory(name: string): "compound" | "isolation" | "cardio" | "stretch" {
  const n = name.toLowerCase();

  if (
    n.includes("burpee") ||
    n.includes("jump") ||
    n.includes("sprint") ||
    n.includes("rope") ||
    n.includes("carry") ||
    n.includes("crawl") ||
    n.includes("slams") ||
    n.includes("throws") ||
    n.includes("erg") ||
    n.includes("rowing")
  ) {
    return "cardio";
  }

  if (
    n.includes("curl") ||
    n.includes("extension") ||
    n.includes("raise") ||
    n.includes("fly") ||
    n.includes("pushdown") ||
    n.includes("adduction") ||
    n.includes("rotation") ||
    n.includes("rotations") ||
    n.includes("crunch") ||
    n.includes("plank") ||
    n.includes("hold") ||
    n.includes("kickback") ||
    n.includes("sit-up") ||
    n.includes("side bend") ||
    n.includes("woodchopper") ||
    n.includes("pallof") ||
    n.includes("tibialis")
  ) {
    return "isolation";
  }

  return "compound";
}

export const EXERCISE_LIBRARY: Exercise[] = Object.entries(EXERCISE_NAMES).flatMap(
  ([muscleGroup, names]) => {
    const uniqueNames = [...new Set(names)];

    return uniqueNames.map((name) => ({
      id: `lib-${muscleGroup}-${slugify(name)}`,
      name,
      slug: slugify(name),
      muscle_group: muscleGroup,
      equipment: inferEquipment(name),
      category: inferCategory(name),
      instructions: null,
      form_tips: null,
      image_url: null,
    }));
  }
);
