/**
 * Unit tests for playCoinFlip pure function.
 *
 * Uses deterministic RNG injection to force specific outcomes and
 * validates all acceptance criteria from story 07-01.
 */

import { playCoinFlip } from "../coinflip";
import type { GameChoice } from "@/lib/mvola/types";

// Helper RNG factories
const rngAlways = (outcome: GameChoice) => () => outcome;

describe("playCoinFlip", () => {
  describe("forced heads — player chose heads (win)", () => {
    it("returns outcome=heads, result=win, delta=+bet", () => {
      const result = playCoinFlip(100, "heads", rngAlways("heads"));
      expect(result).toEqual({ outcome: "heads", result: "win", delta: 100 });
    });
  });

  describe("forced heads — player chose tails (loss)", () => {
    it("returns outcome=heads, result=loss, delta=-bet", () => {
      const result = playCoinFlip(50, "tails", rngAlways("heads"));
      expect(result).toEqual({ outcome: "heads", result: "loss", delta: -50 });
    });
  });

  describe("forced tails — player chose tails (win)", () => {
    it("returns outcome=tails, result=win, delta=+bet", () => {
      const result = playCoinFlip(200, "tails", rngAlways("tails"));
      expect(result).toEqual({ outcome: "tails", result: "win", delta: 200 });
    });
  });

  describe("forced tails — player chose heads (loss)", () => {
    it("returns outcome=tails, result=loss, delta=-bet", () => {
      const result = playCoinFlip(75, "heads", rngAlways("tails"));
      expect(result).toEqual({ outcome: "tails", result: "loss", delta: -75 });
    });
  });

  describe("bet validation", () => {
    it("throws when bet is 0", () => {
      expect(() => playCoinFlip(0, "heads", rngAlways("heads"))).toThrow(Error);
    });

    it("throws when bet is negative (-5)", () => {
      expect(() => playCoinFlip(-5, "heads", rngAlways("heads"))).toThrow(
        Error
      );
    });

    it("throws when bet is a non-integer (1.5)", () => {
      expect(() => playCoinFlip(1.5, "heads", rngAlways("heads"))).toThrow(
        Error
      );
    });

    it("error message describes the invalid bet", () => {
      expect(() => playCoinFlip(0, "heads", rngAlways("heads"))).toThrow(
        /bet must be a positive integer/
      );
    });
  });

  describe("default RNG distribution", () => {
    it("produces both heads and tails across 1000 calls (each at least 400 times)", () => {
      const counts: Record<GameChoice, number> = { heads: 0, tails: 0 };
      for (let i = 0; i < 1000; i++) {
        const { outcome } = playCoinFlip(1, "heads");
        counts[outcome]++;
      }
      expect(counts.heads).toBeGreaterThanOrEqual(400);
      expect(counts.tails).toBeGreaterThanOrEqual(400);
    });
  });

  describe("return type shape", () => {
    it("returns an object with exactly outcome, result, and delta keys", () => {
      const res = playCoinFlip(10, "heads", rngAlways("heads"));
      expect(Object.keys(res).sort()).toEqual(["delta", "outcome", "result"]);
    });
  });
});
