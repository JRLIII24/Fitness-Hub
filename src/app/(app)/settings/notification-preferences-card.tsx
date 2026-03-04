"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Moon } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  checkNotificationPermission,
  requestNotificationPermission,
  scheduleWorkoutReminder,
  cancelWorkoutReminder,
  type NotificationPermission,
} from "@/lib/native/notifications";
import { toast } from "sonner";

interface NotifPrefs {
  streak_alerts_enabled: boolean;
  pod_pings_enabled: boolean;
  workout_reminders_enabled: boolean;
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
}

const DEFAULT_PREFS: NotifPrefs = {
  streak_alerts_enabled: true,
  pod_pings_enabled: true,
  workout_reminders_enabled: true,
  quiet_hours_start: null,
  quiet_hours_end: null,
};

export function NotificationPreferencesCard() {
  const [permission, setPermission] = useState<NotificationPermission>("prompt");
  const [reminderHour, setReminderHour] = useState(18);
  const [reminderMinute, setReminderMinute] = useState(0);
  const [isScheduled, setIsScheduled] = useState(false);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS);
  const [quietEnabled, setQuietEnabled] = useState(false);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!isNative) return;
    checkNotificationPermission().then(setPermission);
  }, [isNative]);

  const fetchPrefs = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/preferences");
      if (res.ok) {
        const data = await res.json();
        setPrefs(data);
        setQuietEnabled(data.quiet_hours_start != null && data.quiet_hours_end != null);
      }
    } catch {
      // Use defaults
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = async (updates: Partial<NotifPrefs>) => {
    const newPrefs = { ...prefs, ...updates };
    setPrefs(newPrefs);

    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferences updated");
    } catch {
      setPrefs(prefs); // revert
      toast.error("Failed to save preferences");
    }
  };

  if (!isNative) return null;

  const handleEnable = async () => {
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") toast.success("Notifications enabled");
    else toast.error("Permission denied. Enable in your device settings.");
  };

  const handleSchedule = async () => {
    await scheduleWorkoutReminder(reminderHour, reminderMinute);
    setIsScheduled(true);
    toast.success(`Daily reminder set for ${String(reminderHour).padStart(2, "0")}:${String(reminderMinute).padStart(2, "0")}`);
  };

  const handleCancel = async () => {
    await cancelWorkoutReminder();
    setIsScheduled(false);
    toast.success("Reminder cancelled");
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-primary" />
          Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {permission !== "granted" ? (
          <div className="space-y-3">
            <p className="text-[12px] text-muted-foreground">
              Get a daily nudge when you haven&apos;t trained yet. Never break your streak.
            </p>
            <Button onClick={handleEnable} size="sm" className="w-full">
              Enable Notifications
            </Button>
          </div>
        ) : (
          <>
            {/* Workout Reminder Time */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Workout Reminder
              </p>
              <div className="flex items-center gap-3">
                <label className="text-[12px] font-medium text-muted-foreground">Remind at</label>
                <select
                  value={reminderHour}
                  onChange={(e) => setReminderHour(Number(e.target.value))}
                  className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-[13px]"
                >
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                  ))}
                </select>
                <span className="text-muted-foreground">:</span>
                <select
                  value={reminderMinute}
                  onChange={(e) => setReminderMinute(Number(e.target.value))}
                  className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-[13px]"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSchedule} size="sm" className="flex-1">
                  {isScheduled ? "Update Reminder" : "Set Reminder"}
                </Button>
                {isScheduled && (
                  <Button onClick={handleCancel} size="sm" variant="outline">
                    <BellOff className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* Pod Notification Preferences */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Pod Notifications
              </p>

              <div className="flex items-center justify-between">
                <Label htmlFor="streak-alerts" className="text-[13px]">
                  Streak risk alerts
                </Label>
                <Switch
                  id="streak-alerts"
                  checked={prefs.streak_alerts_enabled}
                  onCheckedChange={(checked) => updatePref({ streak_alerts_enabled: checked })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Get notified when a pod mate is about to lose their streak
              </p>

              <div className="flex items-center justify-between">
                <Label htmlFor="pod-pings" className="text-[13px]">
                  Pod pings
                </Label>
                <Switch
                  id="pod-pings"
                  checked={prefs.pod_pings_enabled}
                  onCheckedChange={(checked) => updatePref({ pod_pings_enabled: checked })}
                />
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Receive accountability pings from pod members
              </p>
            </div>

            {/* Quiet Hours */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                  <Label htmlFor="quiet-hours" className="text-[13px]">
                    Quiet hours
                  </Label>
                </div>
                <Switch
                  id="quiet-hours"
                  checked={quietEnabled}
                  onCheckedChange={(checked) => {
                    setQuietEnabled(checked);
                    if (checked) {
                      updatePref({ quiet_hours_start: 22, quiet_hours_end: 7 });
                    } else {
                      updatePref({ quiet_hours_start: null, quiet_hours_end: null });
                    }
                  }}
                />
              </div>

              {quietEnabled && (
                <div className="flex items-center gap-3">
                  <select
                    value={prefs.quiet_hours_start ?? 22}
                    onChange={(e) => updatePref({ quiet_hours_start: Number(e.target.value) })}
                    className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-[13px]"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                  <span className="text-[12px] text-muted-foreground">to</span>
                  <select
                    value={prefs.quiet_hours_end ?? 7}
                    onChange={(e) => updatePref({ quiet_hours_end: Number(e.target.value) })}
                    className="rounded-lg border border-border/60 bg-card/40 px-2 py-1.5 text-[13px]"
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
