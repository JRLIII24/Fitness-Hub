import { Capacitor } from "@capacitor/core";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let LiveActivities: any = null;

async function getLiveActivities() {
  if (typeof window === "undefined") return null;
  if (Capacitor.getPlatform() !== "ios") return null;
  if (!LiveActivities) {
    try {
      // The package is not yet installed — this will throw at runtime and
      // return null gracefully.  We use a variable so the bundler does NOT
      // try to resolve the specifier at compile time.
      const pkg = "@capawesome/capacitor-live-activities";
      const mod = await (Function("p", "return import(p)")(pkg) as Promise<any>);
      LiveActivities = mod.LiveActivities;
    } catch {
      return null;
    }
  }
  return LiveActivities;
}

export async function startRestTimerActivity(exerciseName: string, endTimeMs: number) {
  const LA = await getLiveActivities();
  if (!LA) return;
  try {
    await LA.startActivity({
      activityId: "rest-timer",
      data: { exerciseName, endTime: Math.floor(endTimeMs / 1000) },
    });
  } catch (e) {
    console.warn("[live-activity] start failed:", e);
  }
}

export async function stopRestTimerActivity() {
  const LA = await getLiveActivities();
  if (!LA) return;
  try {
    await LA.endActivity({ activityId: "rest-timer" });
  } catch (e) {
    console.warn("[live-activity] stop failed:", e);
  }
}
