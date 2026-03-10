import { describe, it, expect } from "vitest";
import {
  isMissingTableError,
  isPersonalRecord,
  findPreviousBest,
  formatDuration,
  calculateDurationSeconds,
  calculateTotalVolume,
  didBeatGhost,
  calculateXpAwarded,
  getMilestoneText,
} from "../completion-utils";

describe("isMissingTableError", () => {
  it("returns false for null/undefined", () => {
    expect(isMissingTableError(null)).toBe(false);
    expect(isMissingTableError(undefined)).toBe(false);
  });

  it("returns false for non-object errors", () => {
    expect(isMissingTableError("some error")).toBe(false);
    expect(isMissingTableError(42)).toBe(false);
  });

  it("detects PGRST205 error code", () => {
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
  });

  it('detects "could not find the table" in message', () => {
    expect(
      isMissingTableError({ message: "Could not find the table workout_sets" }),
    ).toBe(true);
  });

  it('detects "relation does not exist" in details', () => {
    expect(
      isMissingTableError({
        message: "Error",
        details: 'relation "workout_sets" does not exist',
      }),
    ).toBe(true);
  });

  it("returns false for generic errors", () => {
    expect(
      isMissingTableError({ code: "23505", message: "unique violation" }),
    ).toBe(false);
  });
});

describe("isPersonalRecord", () => {
  it("detects PR when same reps but higher weight", () => {
    expect(isPersonalRecord(105, 5, 100, 5)).toBe(true);
  });

  it("detects PR when same weight but more reps", () => {
    expect(isPersonalRecord(100, 6, 100, 5)).toBe(true);
  });

  it("detects PR when both weight and reps are higher", () => {
    expect(isPersonalRecord(105, 6, 100, 5)).toBe(true);
  });

  it("returns false when weight and reps are the same", () => {
    expect(isPersonalRecord(100, 5, 100, 5)).toBe(false);
  });

  it("returns false when weight is lower", () => {
    expect(isPersonalRecord(95, 5, 100, 5)).toBe(false);
  });

  it("returns false when higher weight but fewer reps", () => {
    // Higher weight, fewer reps — not a PR by this definition
    expect(isPersonalRecord(110, 3, 100, 5)).toBe(false);
  });

  it("returns false when fewer reps and lower weight", () => {
    expect(isPersonalRecord(90, 4, 100, 5)).toBe(false);
  });
});

describe("findPreviousBest", () => {
  it("returns null for empty array", () => {
    expect(findPreviousBest([])).toBeNull();
  });

  it("returns the set with highest volume", () => {
    const sets = [
      { weight: 80, reps: 5 },   // 400
      { weight: 100, reps: 3 },  // 300
      { weight: 60, reps: 10 },  // 600
    ];
    const best = findPreviousBest(sets);
    expect(best).toEqual({ weight: 60, reps: 10 });
  });

  it("skips sets with null values", () => {
    const sets = [
      { weight: null, reps: 10 },
      { weight: 80, reps: null },
      { weight: 60, reps: 5 },  // 300, the only valid one
    ];
    const best = findPreviousBest(sets);
    expect(best).toEqual({ weight: 60, reps: 5 });
  });

  it("handles single set", () => {
    const sets = [{ weight: 100, reps: 5 }];
    expect(findPreviousBest(sets)).toEqual({ weight: 100, reps: 5 });
  });

  it("returns the first highest when tied", () => {
    const sets = [
      { weight: 100, reps: 5 },
      { weight: 50, reps: 10 },  // Same volume = 500
    ];
    // The second set won't beat the first (equal score, not greater)
    const best = findPreviousBest(sets);
    expect(best?.weight).toBe(100);
  });
});

describe("formatDuration", () => {
  it("formats minutes only for short workouts", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = "2026-03-08T10:45:00.000Z";
    expect(formatDuration(start, end)).toBe("45m");
  });

  it("formats hours and minutes for long workouts", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = "2026-03-08T11:30:00.000Z";
    expect(formatDuration(start, end)).toBe("1h 30m");
  });

  it("handles exact hour boundaries", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = "2026-03-08T12:00:00.000Z";
    expect(formatDuration(start, end)).toBe("2h 0m");
  });

  it("shows 0m for less than a minute", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = "2026-03-08T10:00:30.000Z";
    expect(formatDuration(start, end)).toBe("0m");
  });

  it("accepts numeric timestamp for endedAt", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = new Date("2026-03-08T10:45:00.000Z").getTime();
    expect(formatDuration(start, end)).toBe("45m");
  });
});

describe("calculateDurationSeconds", () => {
  it("calculates duration in whole seconds", () => {
    const start = "2026-03-08T10:00:00.000Z";
    const end = "2026-03-08T10:45:30.000Z";
    expect(calculateDurationSeconds(start, end)).toBe(2730);
  });

  it("clamps negative durations to 0", () => {
    const start = "2026-03-08T10:45:00.000Z";
    const end = "2026-03-08T10:00:00.000Z";
    expect(calculateDurationSeconds(start, end)).toBe(0);
  });

  it("returns 0 for same start and end", () => {
    const time = "2026-03-08T10:00:00.000Z";
    expect(calculateDurationSeconds(time, time)).toBe(0);
  });
});

describe("calculateTotalVolume", () => {
  it("sums weight * reps across all exercises", () => {
    const exercises = [
      {
        exercise: { id: "1", name: "Bench Press" },
        sets: [
          { weight_kg: 100, reps: 5, completed: true, set_number: 1 },
          { weight_kg: 100, reps: 5, completed: true, set_number: 2 },
        ],
      },
      {
        exercise: { id: "2", name: "Squat" },
        sets: [
          { weight_kg: 120, reps: 3, completed: true, set_number: 1 },
        ],
      },
    ];
    // (100*5) + (100*5) + (120*3) = 500 + 500 + 360 = 1360
    expect(calculateTotalVolume(exercises)).toBe(1360);
  });

  it("treats null weight or reps as 0", () => {
    const exercises = [
      {
        exercise: { id: "1", name: "Bodyweight Dips" },
        sets: [
          { weight_kg: null, reps: 10, completed: true, set_number: 1 },
          { weight_kg: 20, reps: null, completed: true, set_number: 2 },
        ],
      },
    ];
    expect(calculateTotalVolume(exercises)).toBe(0);
  });

  it("returns 0 for empty exercises", () => {
    expect(calculateTotalVolume([])).toBe(0);
  });
});

describe("didBeatGhost", () => {
  it("returns true when current set beats ghost by volume", () => {
    const sets = [
      { weight_kg: 105, reps: 5, completed: true, set_number: 1 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 100, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(true);
  });

  it("returns false when ghost set wins", () => {
    const sets = [
      { weight_kg: 90, reps: 5, completed: true, set_number: 1 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 100, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(false);
  });

  it("returns false when sets are equal", () => {
    const sets = [
      { weight_kg: 100, reps: 5, completed: true, set_number: 1 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 100, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(false);
  });

  it("ignores uncompleted sets", () => {
    const sets = [
      { weight_kg: 200, reps: 10, completed: false, set_number: 1 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 100, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(false);
  });

  it("returns false when no matching ghost set", () => {
    const sets = [
      { weight_kg: 100, reps: 5, completed: true, set_number: 3 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 80, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(false);
  });

  it("returns false for empty ghost sets", () => {
    const sets = [
      { weight_kg: 100, reps: 5, completed: true, set_number: 1 },
    ];
    expect(didBeatGhost(sets, [])).toBe(false);
  });

  it("handles null weight/reps in current sets", () => {
    const sets = [
      { weight_kg: null, reps: 5, completed: true, set_number: 1 },
    ];
    const ghostSets = [{ setNumber: 1, weight: 100, reps: 5 }];
    expect(didBeatGhost(sets, ghostSets)).toBe(false);
  });
});

describe("calculateXpAwarded", () => {
  it("awards base 100 XP + 2 per completed set", () => {
    expect(calculateXpAwarded(0)).toBe(100);
    expect(calculateXpAwarded(1)).toBe(102);
    expect(calculateXpAwarded(10)).toBe(120);
    expect(calculateXpAwarded(25)).toBe(150);
  });
});

describe("getMilestoneText", () => {
  it("shows days to 7-day milestone for new users", () => {
    expect(getMilestoneText(0)).toBe("7 days to 7-day milestone");
    expect(getMilestoneText(3)).toBe("4 days to 7-day milestone");
    expect(getMilestoneText(6)).toBe("1 days to 7-day milestone");
  });

  it("shows days to 30-day milestone after 7", () => {
    expect(getMilestoneText(7)).toBe("23 days to 30-day milestone");
    expect(getMilestoneText(15)).toBe("15 days to 30-day milestone");
  });

  it("shows days to 100-day milestone after 30", () => {
    expect(getMilestoneText(30)).toBe("70 days to 100-day milestone");
  });

  it("shows days to 365-day milestone after 100", () => {
    expect(getMilestoneText(100)).toBe("265 days to 365-day milestone");
  });

  it("shows completion for streak beyond 365", () => {
    expect(getMilestoneText(365)).toBe("Milestone ladder complete");
    expect(getMilestoneText(500)).toBe("Milestone ladder complete");
  });
});
