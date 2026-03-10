/**
 * SSE Streaming Tests: POST /api/ai/program-builder
 *
 * Route: src/app/api/ai/program-builder/route.ts
 * Schema: src/lib/ai-prompts/program-builder.ts (ProgramSchema, ProgramWeekSchema)
 *
 * The route streams via Vercel AI SDK's streamObject():
 *   1. Iterates result.partialObjectStream — emits an SSE "progress" event
 *      each time the partial object gains a new week (wc > prevWeekCount).
 *   2. Awaits result.object for the final validated program.
 *   3. Inserts into training_programs table.
 *   4. Emits SSE "done" with { program_id } on success,
 *      or SSE "error" with { error: string } on failure.
 *
 * SSE wire format (from the sseEvent() helper in the route):
 *   event: <name>\ndata: <JSON>\n\n
 *
 * Mocking strategy:
 *   - 'ai'.streamObject         → returns mock { partialObjectStream, object }
 *   - '@/lib/ai-sdk'            → getAnthropicProvider returns non-null
 *   - '@/lib/rate-limit'        → always allows
 *   - '@/lib/auth-utils'        → returns fake user
 *   - '@/lib/supabase/server'   → stubs profiles read + training_programs insert
 *   - '@/lib/logger'            → silences console output during tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import {
  ProgramSchema,
  ProgramWeekSchema,
} from "@/lib/ai-prompts/program-builder";

// ── Module mocks (hoisted before all imports) ─────────────────────────────
const mockStreamObject = vi.fn();
vi.mock("ai", () => ({
  streamObject: mockStreamObject,
}));

vi.mock("@/lib/ai-sdk", () => ({
  // Non-null return → provider check passes; the returned fn is the model factory
  getAnthropicProvider: vi.fn().mockReturnValue(vi.fn()),
  SONNET: "claude-sonnet-4-20250514",
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/lib/auth-utils", () => ({
  requireAuth: vi.fn().mockResolvedValue({
    user: { id: "user-builder-test-uuid" },
    response: null,
  }),
}));

// Track the insert result so individual tests can configure failure scenarios
const mockInsertSingle = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    from: vi.fn((table: string) => {
      if (table === "profiles") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({
            data: { experience_level: "intermediate", fitness_goal: "strength" },
            error: null,
          }),
        };
      }
      // training_programs insert chain: .insert().select().single()
      return {
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: mockInsertSingle,
      };
    }),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

/** Build a valid ProgramWeek conforming to ProgramWeekSchema */
function buildWeek(n: number): z.infer<typeof ProgramWeekSchema> {
  return {
    week_number: n,
    // Every 4th week is a deload (mirrors PROGRAM_BUILDER_SYSTEM_PROMPT rule)
    focus: n % 4 === 0 ? "Deload — 50% volume" : `Accumulation Phase ${n}`,
    days: [
      {
        day_number: 1,
        name: "Upper Strength",
        exercises: [
          {
            exercise_name: "Bench Press",
            muscle_group: "chest",
            sets: 4,
            reps: "5",
            rpe_target: 8,
            rest_seconds: 180,
          },
          {
            exercise_name: "Barbell Row",
            muscle_group: "back",
            sets: 4,
            reps: "5",
            rest_seconds: 180,
          },
        ],
      },
    ],
  };
}

const MOCK_PROGRAM: z.infer<typeof ProgramSchema> = {
  name: "4-Week Strength Block",
  description: "Linear progression mesocycle for intermediate lifters",
  weeks: [buildWeek(1), buildWeek(2), buildWeek(3), buildWeek(4)],
};

// ── SSE parsing utilities ─────────────────────────────────────────────────

/** Parse all SSE events from a list of Uint8Array chunks */
function parseSseEvents(
  chunks: Uint8Array[]
): Array<{ event: string; data: unknown }> {
  const decoder = new TextDecoder();
  const raw = chunks.map((c) => decoder.decode(c)).join("");
  const events: Array<{ event: string; data: unknown }> = [];

  // Each event block is separated by '\n\n'
  // Format: "event: <name>\ndata: <json>\n\n"
  const blocks = raw.split("\n\n").filter(Boolean);
  for (const block of blocks) {
    const eventMatch = block.match(/^event: (.+)$/m);
    const dataMatch = block.match(/^data: (.+)$/m);
    if (eventMatch && dataMatch) {
      events.push({
        event: eventMatch[1].trim(),
        data: JSON.parse(dataMatch[1].trim()),
      });
    }
  }

  return events;
}

/** Drain a ReadableStream<Uint8Array> to an array of chunks */
async function drainStream(
  stream: ReadableStream<Uint8Array>
): Promise<Uint8Array[]> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  return chunks;
}

/** Build a POST request to /api/ai/program-builder */
function makeRequest(
  body: Record<string, unknown> = {
    goal: "strength",
    weeks: 4,
    days_per_week: 3,
  }
): Request {
  return new Request("http://localhost/api/ai/program-builder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────
describe("POST /api/ai/program-builder — SSE event stream", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  // ── Happy path ────────────────────────────────────────────────────────
  it('emits one "progress" event per new week, then "done" with program_id', async () => {
    // partialObjectStream yields progressively larger partial objects.
    // The route emits "progress" when partial.weeks.length > prevWeekCount.
    const partials = [
      { weeks: [MOCK_PROGRAM.weeks[0]] },                  // triggers progress #1
      { weeks: MOCK_PROGRAM.weeks.slice(0, 2) },            // triggers progress #2
      { weeks: MOCK_PROGRAM.weeks.slice(0, 3) },            // triggers progress #3
      { weeks: MOCK_PROGRAM.weeks },                        // triggers progress #4
    ];

    async function* makePartialStream() {
      for (const p of partials) yield p;
    }

    mockStreamObject.mockReturnValue({
      partialObjectStream: makePartialStream(),
      object: Promise.resolve(MOCK_PROGRAM),
    });

    mockInsertSingle.mockResolvedValue({
      data: { id: "prog-uuid-abc-1234" },
      error: null,
    });

    const { POST } = await import("@/app/api/ai/program-builder/route");
    const response = await POST(makeRequest());

    // ── Response headers must indicate SSE ──────────────────────────────
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");

    // ── Parse and categorize all SSE events ────────────────────────────
    const chunks = await drainStream(response.body as ReadableStream<Uint8Array>);
    const events = parseSseEvents(chunks);
    const byType = (t: string) => events.filter((e) => e.event === t);

    // ── progress events ─────────────────────────────────────────────────
    const progressEvents = byType("progress");
    expect(progressEvents).toHaveLength(4);

    type ProgressData = { weeks_generated: number; current_week_focus: string | null };
    for (let i = 0; i < progressEvents.length; i++) {
      const d = progressEvents[i].data as ProgressData;
      expect(d.weeks_generated).toBe(i + 1);
      expect(
        typeof d.current_week_focus === "string" || d.current_week_focus === null
      ).toBe(true);
    }

    // Last progress event should reflect the final week's focus
    const lastProgress = progressEvents.at(-1)!.data as ProgressData;
    expect(lastProgress.weeks_generated).toBe(4);
    expect(lastProgress.current_week_focus).toBe(MOCK_PROGRAM.weeks[3].focus);

    // ── done event ──────────────────────────────────────────────────────
    const doneEvents = byType("done");
    expect(doneEvents).toHaveLength(1);
    expect((doneEvents[0].data as { program_id: string }).program_id).toBe(
      "prog-uuid-abc-1234"
    );

    // ── no error events in happy path ───────────────────────────────────
    expect(byType("error")).toHaveLength(0);
  });

  it('emits "error" event and no "done" when Supabase insert fails', async () => {
    async function* singleWeekStream() {
      yield { weeks: [MOCK_PROGRAM.weeks[0]] };
    }

    mockStreamObject.mockReturnValue({
      partialObjectStream: singleWeekStream(),
      object: Promise.resolve(MOCK_PROGRAM),
    });

    // Simulate a DB constraint violation or missing table
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: 'relation "training_programs" does not exist' },
    });

    const { POST } = await import("@/app/api/ai/program-builder/route");
    const response = await POST(makeRequest());

    const events = parseSseEvents(
      await drainStream(response.body as ReadableStream<Uint8Array>)
    );

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(
      (errorEvents[0].data as { error: string }).error
    ).toMatch(/failed to save/i);

    // No "done" — the insert failed before we could emit it
    expect(events.filter((e) => e.event === "done")).toHaveLength(0);
  });

  it('emits "error" event when streamObject partialObjectStream throws', async () => {
    // Simulate an Anthropic API error mid-stream
    async function* failingStream() {
      yield { weeks: [] };
      throw new Error("Anthropic API: rate_limit_error");
    }

    mockStreamObject.mockReturnValue({
      partialObjectStream: failingStream(),
      object: Promise.reject(new Error("stream aborted")),
    });

    const { POST } = await import("@/app/api/ai/program-builder/route");
    const response = await POST(makeRequest());

    const events = parseSseEvents(
      await drainStream(response.body as ReadableStream<Uint8Array>)
    );

    const errorEvents = events.filter((e) => e.event === "error");
    expect(errorEvents).toHaveLength(1);
    expect(
      (errorEvents[0].data as { error: string }).error
    ).toMatch(/stream failed/i);

    // Stream must close cleanly even after an error (controller.close() in finally)
    expect(events.filter((e) => e.event === "done")).toHaveLength(0);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    const { rateLimit } = await import("@/lib/rate-limit");
    vi.mocked(rateLimit).mockResolvedValue(false);

    const { POST } = await import("@/app/api/ai/program-builder/route");
    const response = await POST(makeRequest());

    // Rate-limited before streaming begins — returns JSON 429, not SSE
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toHaveProperty("limitReached", true);
  });

  it("returns 400 for invalid request body (weeks out of range)", async () => {
    const { POST } = await import("@/app/api/ai/program-builder/route");

    const response = await POST(
      makeRequest({ goal: "strength", weeks: 99, days_per_week: 3 }) // weeks max is 12
    );

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty("error", "Invalid request");
    expect(body).toHaveProperty("details");
  });

  it("returns 503 when AI provider is unavailable", async () => {
    const { getAnthropicProvider } = await import("@/lib/ai-sdk");
    vi.mocked(getAnthropicProvider).mockReturnValue(null as unknown as ReturnType<typeof getAnthropicProvider>);

    const { POST } = await import("@/app/api/ai/program-builder/route");
    const response = await POST(makeRequest());

    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toHaveProperty("error", "AI unavailable");
  });

  // ── Schema conformance guard ───────────────────────────────────────────
  it("MOCK_PROGRAM fixture conforms to ProgramSchema (fixture integrity guard)", () => {
    const result = ProgramSchema.safeParse(MOCK_PROGRAM);
    expect(
      result.success,
      result.success ? "" : JSON.stringify(result.error, null, 2)
    ).toBe(true);
  });

  it("each buildWeek() output conforms to ProgramWeekSchema", () => {
    for (let n = 1; n <= 12; n++) {
      const week = buildWeek(n);
      const result = ProgramWeekSchema.safeParse(week);
      expect(
        result.success,
        `Week ${n} invalid: ${result.success ? "" : JSON.stringify(result.error)}`
      ).toBe(true);
    }
  });
});
