"use client";

import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface Props {
  workoutDays: Date[];
}

export function ProfileWorkoutCalendar({ workoutDays }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Workout Calendar</h3>
      <DayPicker
        disabled={{ after: new Date() }}
        modifiers={{ workedOut: workoutDays }}
        modifiersClassNames={{
          workedOut: "bg-primary/20 rounded-md font-semibold"
        }}
        className="text-sm"
      />
      <p className="text-xs text-muted-foreground mt-2">
        {workoutDays.length} workouts in the last 90 days
      </p>
    </div>
  );
}
