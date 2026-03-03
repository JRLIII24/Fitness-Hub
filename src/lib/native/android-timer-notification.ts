import { Capacitor } from "@capacitor/core";

export async function showAndroidTimerNotification(exerciseName: string, seconds: number) {
  if (Capacitor.getPlatform() !== "android") return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.schedule({
    notifications: [
      {
        id: 9999,
        title: "Rest Timer",
        body: `${exerciseName} — ${seconds}s rest`,
        ongoing: true,
        autoCancel: false,
        schedule: { at: new Date(Date.now() + seconds * 1000) },
        channelId: "rest-timer",
      },
    ],
  });
}

export async function cancelAndroidTimerNotification() {
  if (Capacitor.getPlatform() !== "android") return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: 9999 }] });
}
