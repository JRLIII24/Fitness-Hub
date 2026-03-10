/**
 * Static coaching cues for common exercises.
 * Displayed during rest timer to reinforce good form on the next set.
 * Keyed by lowercase exercise name — fallback to muscle group cues.
 */

const EXERCISE_CUES: Record<string, string[]> = {
  // Chest
  "barbell bench press": ["Retract shoulder blades, arch upper back", "Drive feet into floor, squeeze glutes", "Lower to mid-chest, elbows ~45°"],
  "incline bench press": ["Set bench to 30-45°, keep wrists stacked", "Touch upper chest, control the eccentric"],
  "incline dumbbell press": ["Neutral grip or slight rotation at top", "Press up and slightly inward"],
  "dumbbell bench press": ["Full stretch at bottom, squeeze at top", "Keep elbows 45° from torso"],
  "dumbbell fly": ["Slight elbow bend, stretch the chest", "Think hugging a tree, not pressing"],
  "cable fly": ["Step forward for constant tension", "Squeeze pecs hard at the midline"],
  "push up": ["Hands shoulder-width, body in a plank", "Chest to floor, lock out at top"],
  "chest dip": ["Lean forward slightly to target chest", "Lower until upper arms are parallel"],

  // Back
  "barbell row": ["Hinge at hips, chest up, pull to navel", "Squeeze shoulder blades at the top"],
  "bent over row": ["Hinge at hips, chest up, pull to navel", "Squeeze shoulder blades at the top"],
  "dumbbell row": ["Brace on bench, pull elbow past torso", "Full stretch at bottom, squeeze at top"],
  "pull up": ["Dead hang start, pull chin over bar", "Drive elbows down and back"],
  "chin up": ["Supinated grip, pull chest to bar", "Control the descent — no kipping"],
  "lat pulldown": ["Lean back slightly, pull to upper chest", "Lead with elbows, not hands"],
  "cable row": ["Sit tall, drive elbows straight back", "Pause at full contraction"],
  "seated cable row": ["Sit tall, drive elbows straight back", "Pause at full contraction"],
  "t-bar row": ["Keep chest on pad, pull to sternum", "Squeeze lats hard at the top"],
  "deadlift": ["Brace core hard, push floor away", "Hips and shoulders rise together"],
  "barbell deadlift": ["Brace core hard, push floor away", "Hips and shoulders rise together"],

  // Shoulders
  "overhead press": ["Brace core, press straight overhead", "Lock out and push head through at top"],
  "barbell overhead press": ["Brace core, press straight overhead", "Lock out and push head through at top"],
  "dumbbell shoulder press": ["Start at ear level, press and converge", "Don't flare elbows excessively"],
  "lateral raise": ["Slight forward lean, lead with elbows", "Raise to shoulder height, control down"],
  "dumbbell lateral raise": ["Slight forward lean, lead with elbows", "Raise to shoulder height, control down"],
  "face pull": ["External rotate at the top, pull apart", "High elbow position, squeeze rear delts"],
  "arnold press": ["Rotate palms from facing you to forward", "Full range of motion, control the rotation"],
  "front raise": ["Thumbs up or neutral grip, stop at eye level", "Control the negative — no swinging"],

  // Legs
  "barbell squat": ["Chest up, drive through heels", "Break at hips and knees simultaneously", "Knees track over toes, brace core"],
  "back squat": ["Chest up, drive through heels", "Break at hips and knees simultaneously"],
  "front squat": ["Elbows high, core braced", "Sit between your hips, stay upright"],
  "goblet squat": ["Hold dumbbell at chest, elbows between knees", "Sit deep, drive knees out"],
  "leg press": ["Full range, don't lock out knees", "Press through the whole foot"],
  "romanian deadlift": ["Hinge at hips, soft knees, bar close to legs", "Feel the hamstring stretch, squeeze glutes at top"],
  "barbell romanian deadlift": ["Hinge at hips, soft knees, bar close to legs", "Feel the hamstring stretch, squeeze glutes at top"],
  "bulgarian split squat": ["Front shin vertical, torso upright", "Drive through front heel, control the descent"],
  "lunge": ["Step far enough to keep shin vertical", "Drive through front heel, don't let knee cave"],
  "walking lunge": ["Long stride, torso upright", "Alternate legs with control"],
  "leg curl": ["Control the negative, squeeze hamstrings", "Don't let hips rise off the pad"],
  "leg extension": ["Squeeze quads hard at full extension", "Control the descent — no dropping"],
  "hip thrust": ["Drive through heels, squeeze glutes at top", "Chin tucked, ribs down at lockout"],
  "barbell hip thrust": ["Drive through heels, squeeze glutes at top", "Chin tucked, ribs down at lockout"],
  "calf raise": ["Full stretch at bottom, pause at top", "Slow eccentric, explosive concentric"],

  // Arms
  "barbell curl": ["Pin elbows to sides, no swinging", "Squeeze biceps at the top, control down"],
  "dumbbell curl": ["Supinate at the top for peak contraction", "Full extension at bottom"],
  "hammer curl": ["Neutral grip, elbows pinned", "Great for brachialis — control both phases"],
  "preacher curl": ["Chest against pad, full stretch at bottom", "Don't hyperextend at the bottom"],
  "tricep pushdown": ["Pin elbows, extend fully", "Squeeze triceps hard at lockout"],
  "cable tricep pushdown": ["Pin elbows, extend fully", "Squeeze triceps hard at lockout"],
  "skull crusher": ["Lower to forehead, elbows fixed", "Press back up without flaring elbows"],
  "overhead tricep extension": ["Keep elbows close to head", "Full stretch at bottom, lock out at top"],
  "close grip bench press": ["Hands shoulder-width, elbows tucked", "Drive through triceps at lockout"],

  // Core
  "plank": ["Squeeze glutes and quads, breathe steadily", "Don't let hips sag or pike up"],
  "hanging leg raise": ["Controlled swing, curl pelvis up", "Lower slowly — no momentum"],
  "cable crunch": ["Round the spine, don't hip-hinge", "Squeeze abs hard at the bottom"],
  "ab wheel rollout": ["Brace core, extend as far as controlled", "Pull back with abs, not arms"],
};

/** Fallback cues by muscle group when no exact exercise match */
const MUSCLE_GROUP_CUES: Record<string, string[]> = {
  chest: ["Retract shoulder blades, control the negative", "Full stretch at bottom, squeeze at top"],
  back: ["Initiate with lats, not biceps", "Squeeze shoulder blades together at contraction"],
  shoulders: ["Brace core, avoid excessive arching", "Control the weight — no momentum"],
  legs: ["Brace core, drive through your heels", "Full range of motion, control the eccentric"],
  quads: ["Drive through the whole foot, knees track toes", "Full depth if mobility allows"],
  hamstrings: ["Feel the stretch, hinge at the hips", "Squeeze at the top, control down"],
  glutes: ["Squeeze hard at lockout, don't hyperextend", "Drive through heels"],
  biceps: ["Pin elbows to sides, full range of motion", "Control the negative — no swinging"],
  triceps: ["Lock out fully, keep elbows fixed", "Squeeze hard at extension"],
  core: ["Brace like you're about to be punched", "Control breathing, don't hold your breath"],
  calves: ["Full stretch at bottom, explosive press up", "Pause at the top for peak contraction"],
  forearms: ["Grip hard, control the movement", "Full range of motion both directions"],
};

const GENERIC_CUES = [
  "Breathe — exhale on effort, inhale on the eccentric",
  "Focus on mind-muscle connection this set",
  "Control the negative for maximum gains",
];

/**
 * Get a coaching cue for the given exercise.
 * Returns a single random cue string.
 */
export function getCoachingCue(exerciseName: string, muscleGroup?: string): string {
  const key = exerciseName.toLowerCase().trim();

  // Exact match
  const exact = EXERCISE_CUES[key];
  if (exact) return exact[Math.floor(Math.random() * exact.length)];

  // Substring match (e.g. "Dumbbell Incline Bench Press" matches "incline bench press")
  for (const [pattern, cues] of Object.entries(EXERCISE_CUES)) {
    if (key.includes(pattern) || pattern.includes(key)) {
      return cues[Math.floor(Math.random() * cues.length)];
    }
  }

  // Muscle group fallback
  if (muscleGroup) {
    const groupKey = muscleGroup.toLowerCase().trim();
    const groupCues = MUSCLE_GROUP_CUES[groupKey];
    if (groupCues) return groupCues[Math.floor(Math.random() * groupCues.length)];
  }

  // Generic fallback
  return GENERIC_CUES[Math.floor(Math.random() * GENERIC_CUES.length)];
}
