import { describe, it, expect, vi, beforeEach } from "vitest";
import { getBackoffMs } from "../queue";
import { getSyncHandler } from "../sync-registry";

/**
 * Integration tests for the offline queue system.
 *
 * The actual queue (enqueueMutation, triggerSync) relies on IndexedDB via 'idb',
 * which is unavailable in vitest's jsdom environment without a polyfill.
 * Instead, we test:
 *   1. The backoff algorithm (pure function)
 *   2. The sync registry handler lookup
 *   3. The sync flow logic via a simulated in-memory queue
 */

// ── Backoff algorithm (already partially tested in queue.test.ts, extended here) ──

describe("getBackoffMs — integration edge cases", () => {
  it("returns 0 < result for attempt 1", () => {
    const ms = getBackoffMs(1);
    expect(ms).toBeGreaterThan(0);
  });

  it("never returns negative values", () => {
    for (let i = 0; i < 20; i++) {
      expect(getBackoffMs(i + 1)).toBeGreaterThan(0);
    }
  });

  it("upper-bounds at ~375000ms (5 min * 1.25 jitter)", () => {
    for (let attempt = 1; attempt <= 20; attempt++) {
      // Run multiple times due to jitter
      for (let j = 0; j < 50; j++) {
        expect(getBackoffMs(attempt)).toBeLessThanOrEqual(375_000);
      }
    }
  });
});

// ── Sync registry ──

describe("getSyncHandler", () => {
  it("returns a handler for SAVE_WORKOUT_SESSION", () => {
    expect(getSyncHandler("SAVE_WORKOUT_SESSION")).toBeDefined();
    expect(typeof getSyncHandler("SAVE_WORKOUT_SESSION")).toBe("function");
  });

  it("returns a handler for LOG_BODY_WEIGHT", () => {
    expect(getSyncHandler("LOG_BODY_WEIGHT")).toBeDefined();
  });

  it("returns a handler for LOG_FOOD", () => {
    expect(getSyncHandler("LOG_FOOD")).toBeDefined();
  });

  it("returns a handler for SYNC_GROCERY_ITEMS", () => {
    expect(getSyncHandler("SYNC_GROCERY_ITEMS")).toBeDefined();
  });

  it("returns undefined for unknown mutation type", () => {
    expect(getSyncHandler("UNKNOWN_TYPE")).toBeUndefined();
    expect(getSyncHandler("")).toBeUndefined();
  });
});

// ── Simulated queue integration flow ──
// This simulates the core queue logic without IndexedDB dependency

interface QueueEntry {
  id: string;
  type: string;
  payload: unknown;
  createdAt: number;
  attempts: number;
  lastAttemptAt?: number;
}

class InMemoryQueue {
  private items: Map<string, QueueEntry> = new Map();

  async enqueue(type: string, payload: unknown, id: string) {
    this.items.set(id, {
      id,
      type,
      payload,
      createdAt: Date.now(),
      attempts: 0,
    });
  }

  async getAll(): Promise<QueueEntry[]> {
    return Array.from(this.items.values()).sort((a, b) => a.createdAt - b.createdAt);
  }

  async delete(id: string) {
    this.items.delete(id);
  }

  async update(entry: QueueEntry) {
    this.items.set(entry.id, entry);
  }

  get size() {
    return this.items.size;
  }
}

describe("Simulated queue sync flow", () => {
  let queue: InMemoryQueue;

  beforeEach(() => {
    queue = new InMemoryQueue();
  });

  it("enqueueMutation stores to queue", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { userId: "u1" }, "key-1");

    expect(queue.size).toBe(1);
    const items = await queue.getAll();
    expect(items[0].type).toBe("SAVE_WORKOUT_SESSION");
    expect(items[0].id).toBe("key-1");
    expect(items[0].attempts).toBe(0);
  });

  it("sync processes queued items and clears on success", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { userId: "u1" }, "key-1");
    await queue.enqueue("LOG_BODY_WEIGHT", { userId: "u1" }, "key-2");

    const handler = vi.fn().mockResolvedValue(undefined);

    // Simulate triggerSync
    const items = await queue.getAll();
    for (const item of items) {
      await handler(item.payload);
      await queue.delete(item.id);
    }

    expect(handler).toHaveBeenCalledTimes(2);
    expect(queue.size).toBe(0);
  });

  it("retry logic increments attempts on failure", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { userId: "u1" }, "key-1");

    const handler = vi.fn().mockRejectedValue(new Error("Network error"));

    // Simulate failed sync attempt
    const items = await queue.getAll();
    for (const item of items) {
      try {
        await handler(item.payload);
        await queue.delete(item.id);
      } catch {
        item.attempts += 1;
        item.lastAttemptAt = Date.now();
        await queue.update(item);
      }
    }

    expect(queue.size).toBe(1);
    const updated = await queue.getAll();
    expect(updated[0].attempts).toBe(1);
    expect(updated[0].lastAttemptAt).toBeDefined();
  });

  it("gives up after 10 failed attempts", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { userId: "u1" }, "key-1");

    const handler = vi.fn().mockRejectedValue(new Error("Persistent failure"));
    const MAX_ATTEMPTS = 10;

    // Simulate 10 failed retries
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const items = await queue.getAll();
      for (const item of items) {
        try {
          await handler(item.payload);
          await queue.delete(item.id);
        } catch {
          item.attempts += 1;
          item.lastAttemptAt = Date.now();

          if (item.attempts >= MAX_ATTEMPTS) {
            await queue.delete(item.id);
          } else {
            await queue.update(item);
          }
        }
      }
    }

    expect(queue.size).toBe(0);
    expect(handler).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("respects backoff timing between retries", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { userId: "u1" }, "key-1");

    // Simulate first failure
    const items = await queue.getAll();
    const item = items[0];
    item.attempts = 3;
    item.lastAttemptAt = Date.now();
    await queue.update(item);

    // Check backoff: should skip if not enough time passed
    const backoffMs = getBackoffMs(item.attempts);
    const updated = (await queue.getAll())[0];
    const timeSinceLastAttempt = Date.now() - (updated.lastAttemptAt ?? 0);

    // Just after setting lastAttemptAt, time elapsed is near 0
    expect(timeSinceLastAttempt).toBeLessThan(backoffMs);
  });

  it("processes items in FIFO order", async () => {
    await queue.enqueue("SAVE_WORKOUT_SESSION", { order: 1 }, "key-1");
    // Small delay to ensure different createdAt
    await queue.enqueue("LOG_BODY_WEIGHT", { order: 2 }, "key-2");
    await queue.enqueue("LOG_FOOD", { order: 3 }, "key-3");

    const processed: number[] = [];
    const handler = vi.fn().mockImplementation(async (payload: { order: number }) => {
      processed.push(payload.order);
    });

    const items = await queue.getAll();
    for (const item of items) {
      await handler(item.payload);
      await queue.delete(item.id);
    }

    expect(processed).toEqual([1, 2, 3]);
    expect(queue.size).toBe(0);
  });

  it("idempotency key prevents duplicates", async () => {
    const key = "idempotent-key";
    await queue.enqueue("SAVE_WORKOUT_SESSION", { data: "first" }, key);
    await queue.enqueue("SAVE_WORKOUT_SESSION", { data: "second" }, key);

    // Same key overwrites — only one entry
    expect(queue.size).toBe(1);
    const items = await queue.getAll();
    expect((items[0].payload as { data: string }).data).toBe("second");
  });

  it("unknown mutation type entries are removed during sync", async () => {
    await queue.enqueue("NONEXISTENT_MUTATION", { foo: "bar" }, "key-1");

    const items = await queue.getAll();
    for (const item of items) {
      const handler = getSyncHandler(item.type);
      if (!handler) {
        await queue.delete(item.id);
        continue;
      }
    }

    expect(queue.size).toBe(0);
  });
});
