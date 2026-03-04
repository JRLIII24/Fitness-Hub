import { Capacitor } from "@capacitor/core";

export type NotificationPermission = "granted" | "denied" | "prompt";

export async function checkNotificationPermission(): Promise<NotificationPermission> {
  if (!Capacitor.isNativePlatform()) return "denied";
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const { display } = await LocalNotifications.checkPermissions();
  return display as NotificationPermission;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!Capacitor.isNativePlatform()) return "denied";
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  const { display } = await LocalNotifications.requestPermissions();
  return display as NotificationPermission;
}

export async function scheduleWorkoutReminder(hour: number, minute: number): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
  const scheduleDate = new Date();
  scheduleDate.setHours(hour, minute, 0, 0);
  if (scheduleDate <= new Date()) scheduleDate.setDate(scheduleDate.getDate() + 1);
  await LocalNotifications.schedule({
    notifications: [{
      id: 1001,
      title: "Time to train",
      body: "You haven't logged a workout today. Stay consistent!",
      schedule: { at: scheduleDate, repeats: true, every: "day" },
      channelId: "workout-reminder",
    }],
  });
}

export async function cancelWorkoutReminder(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { LocalNotifications } = await import("@capacitor/local-notifications");
  await LocalNotifications.cancel({ notifications: [{ id: 1001 }] });
}
