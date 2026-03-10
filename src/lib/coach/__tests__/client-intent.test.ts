import { describe, it, expect } from "vitest";
import { detectSimpleIntent } from "../client-intent";

describe("detectSimpleIntent", () => {
  // ── Greetings ──

  describe("greeting detection", () => {
    it("detects common greetings", () => {
      const greetings = ["hey", "hi", "hello", "yo", "howdy", "hiya", "sup"];
      for (const g of greetings) {
        const result = detectSimpleIntent(g);
        expect(result).not.toBeNull();
        expect(result).not.toBe("");
        // Should be one of the canned greeting responses
        expect(result).toMatch(/help|crush|coaching/i);
      }
    });

    it("is case insensitive", () => {
      expect(detectSimpleIntent("HEY")).not.toBeNull();
      expect(detectSimpleIntent("Hello")).not.toBeNull();
      expect(detectSimpleIntent("HI")).not.toBeNull();
    });

    it("detects greetings with trailing text", () => {
      expect(detectSimpleIntent("hey there")).not.toBeNull();
      expect(detectSimpleIntent("hello coach")).not.toBeNull();
      expect(detectSimpleIntent("hi!")).not.toBeNull();
    });

    it("handles what's up variations", () => {
      expect(detectSimpleIntent("what's up")).not.toBeNull();
      expect(detectSimpleIntent("whats up")).not.toBeNull();
    });
  });

  // ── Thanks ──

  describe("thanks detection", () => {
    it("detects common thank expressions", () => {
      const thanks = ["thanks", "thank you", "thx", "ty", "cheers", "appreciate it"];
      for (const t of thanks) {
        const result = detectSimpleIntent(t);
        expect(result).not.toBeNull();
        expect(result).not.toBe("");
        expect(result).toMatch(/welcome|anytime|problem/i);
      }
    });

    it("is case insensitive", () => {
      expect(detectSimpleIntent("THANKS")).not.toBeNull();
      expect(detectSimpleIntent("Thank You")).not.toBeNull();
    });
  });

  // ── Affirmations ──

  describe("affirmation detection", () => {
    it("detects affirmations and returns empty string (silent ack)", () => {
      const affirmations = [
        "ok", "okay", "k", "got it", "cool", "nice",
        "sounds good", "alright", "perfect", "great",
        "bet", "word", "aight",
      ];
      for (const a of affirmations) {
        const result = detectSimpleIntent(a);
        expect(result).toBe("");
      }
    });

    it("handles trailing punctuation", () => {
      expect(detectSimpleIntent("ok.")).toBe("");
      expect(detectSimpleIntent("cool!")).toBe("");
      expect(detectSimpleIntent("perfect.")).toBe("");
    });

    it("is case insensitive for affirmations", () => {
      expect(detectSimpleIntent("OK")).toBe("");
      expect(detectSimpleIntent("COOL")).toBe("");
      expect(detectSimpleIntent("Got It")).toBe("");
    });
  });

  // ── Complex intents (should return null) ──

  describe("complex intents return null", () => {
    it("returns null for workout questions", () => {
      expect(detectSimpleIntent("What exercises should I do for chest?")).toBeNull();
      expect(detectSimpleIntent("Can you swap bench press for dumbbell press?")).toBeNull();
      expect(detectSimpleIntent("How much weight should I use for squats?")).toBeNull();
    });

    it("returns null for coaching requests", () => {
      expect(detectSimpleIntent("Give me a push pull legs routine")).toBeNull();
      expect(detectSimpleIntent("What's my readiness score?")).toBeNull();
      expect(detectSimpleIntent("How is my form on deadlift?")).toBeNull();
    });

    it("returns null for messages longer than 40 chars", () => {
      // Even if it starts with a greeting, long messages go to API
      const longGreeting = "hey can you help me figure out a good workout for today";
      expect(longGreeting.length).toBeGreaterThan(40);
      expect(detectSimpleIntent(longGreeting)).toBeNull();
    });

    it("returns null for set logging commands", () => {
      expect(detectSimpleIntent("log 100kg for 5 reps")).toBeNull();
      expect(detectSimpleIntent("add 3 sets of bench")).toBeNull();
    });

    it("returns null for timer commands", () => {
      expect(detectSimpleIntent("start 90 second timer")).toBeNull();
      expect(detectSimpleIntent("set timer for 2 minutes")).toBeNull();
    });

    it("returns null for unrecognized short messages", () => {
      expect(detectSimpleIntent("abc")).toBeNull();
      expect(detectSimpleIntent("hmm")).toBeNull();
      expect(detectSimpleIntent("?")).toBeNull();
    });
  });

  // ── Edge cases ──

  describe("edge cases", () => {
    it("handles whitespace-only input", () => {
      expect(detectSimpleIntent("   ")).toBeNull();
    });

    it("handles empty string", () => {
      expect(detectSimpleIntent("")).toBeNull();
    });

    it("trims whitespace before matching", () => {
      expect(detectSimpleIntent("  hey  ")).not.toBeNull();
      expect(detectSimpleIntent("  ok  ")).toBe("");
      expect(detectSimpleIntent("  thanks  ")).not.toBeNull();
    });

    it("greeting at start of message is detected even with trailing words", () => {
      // "hi how are you" — starts with greeting, under 40 chars
      const result = detectSimpleIntent("hi how are you");
      expect(result).not.toBeNull();
    });
  });
});
