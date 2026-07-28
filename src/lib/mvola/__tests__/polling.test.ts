/**
 * Tests for src/lib/mvola/polling.ts — Polling Policy Module
 *
 * Covers:
 * - Default POLL_INTERVAL_MS (3000) and POLL_TIMEOUT_MS (120000) when env is absent
 * - Overrides via MVOLA_POLL_INTERVAL_MS / MVOLA_POLL_TIMEOUT_MS
 * - Fallback to the default on non-numeric, zero, negative, or absent env values
 *
 * The module reads process.env once at import time, so every test that changes
 * process.env must jest.resetModules() and re-import (same pattern as auth.test.ts).
 */

describe("polling.ts", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.MVOLA_POLL_INTERVAL_MS;
    delete process.env.MVOLA_POLL_TIMEOUT_MS;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  describe("POLL_INTERVAL_MS", () => {
    it("defaults to 3000 when MVOLA_POLL_INTERVAL_MS is absent", async () => {
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(POLL_INTERVAL_MS).toBe(3000);
    });

    it("uses MVOLA_POLL_INTERVAL_MS when set to a valid positive number", async () => {
      process.env.MVOLA_POLL_INTERVAL_MS = "5000";
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(POLL_INTERVAL_MS).toBe(5000);
    });

    it("falls back to 3000 when MVOLA_POLL_INTERVAL_MS is non-numeric", async () => {
      process.env.MVOLA_POLL_INTERVAL_MS = "not-a-number";
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(POLL_INTERVAL_MS).toBe(3000);
    });

    it("falls back to 3000 when MVOLA_POLL_INTERVAL_MS is zero", async () => {
      process.env.MVOLA_POLL_INTERVAL_MS = "0";
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(POLL_INTERVAL_MS).toBe(3000);
    });

    it("falls back to 3000 when MVOLA_POLL_INTERVAL_MS is negative", async () => {
      process.env.MVOLA_POLL_INTERVAL_MS = "-1000";
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(POLL_INTERVAL_MS).toBe(3000);
    });

    it("never produces NaN regardless of input", async () => {
      process.env.MVOLA_POLL_INTERVAL_MS = "NaN";
      const { POLL_INTERVAL_MS } = await import("../polling");
      expect(Number.isNaN(POLL_INTERVAL_MS)).toBe(false);
    });
  });

  describe("POLL_TIMEOUT_MS", () => {
    it("defaults to 120000 when MVOLA_POLL_TIMEOUT_MS is absent", async () => {
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(POLL_TIMEOUT_MS).toBe(120000);
    });

    it("uses MVOLA_POLL_TIMEOUT_MS when set to a valid positive number", async () => {
      process.env.MVOLA_POLL_TIMEOUT_MS = "60000";
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(POLL_TIMEOUT_MS).toBe(60000);
    });

    it("falls back to 120000 when MVOLA_POLL_TIMEOUT_MS is non-numeric", async () => {
      process.env.MVOLA_POLL_TIMEOUT_MS = "abc";
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(POLL_TIMEOUT_MS).toBe(120000);
    });

    it("falls back to 120000 when MVOLA_POLL_TIMEOUT_MS is zero", async () => {
      process.env.MVOLA_POLL_TIMEOUT_MS = "0";
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(POLL_TIMEOUT_MS).toBe(120000);
    });

    it("falls back to 120000 when MVOLA_POLL_TIMEOUT_MS is negative", async () => {
      process.env.MVOLA_POLL_TIMEOUT_MS = "-1";
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(POLL_TIMEOUT_MS).toBe(120000);
    });

    it("never produces NaN regardless of input", async () => {
      process.env.MVOLA_POLL_TIMEOUT_MS = "NaN";
      const { POLL_TIMEOUT_MS } = await import("../polling");
      expect(Number.isNaN(POLL_TIMEOUT_MS)).toBe(false);
    });
  });

  it("exports only POLL_INTERVAL_MS and POLL_TIMEOUT_MS as named exports", async () => {
    const mod = await import("../polling");
    expect(Object.keys(mod).sort()).toEqual(["POLL_INTERVAL_MS", "POLL_TIMEOUT_MS"]);
  });
});
