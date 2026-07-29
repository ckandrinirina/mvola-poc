/**
 * MVola Polling Policy
 *
 * Single source for the two client-polling timing knobs used across the withdraw/deposit
 * status flow: how often the browser polls GET /api/mvola/status/{correlationId}, and how
 * long it keeps polling before reporting "still pending" instead of settling. Delegates to
 * no other module — this file only reads and validates its own two env vars.
 *
 * Values are read once at import time (module-level constants), matching how
 * `client.ts::getBaseUrl()` reads `MVOLA_ENV`. Callers that need a fresh read after
 * mutating `process.env` (tests) must `jest.resetModules()` and re-import.
 */

/**
 * Reads and validates a millisecond duration from an environment variable.
 *
 * @param name - The environment variable name to read
 * @param fallback - The value to use when the env var is absent, non-numeric, zero, or negative
 * @returns A finite, positive number of milliseconds — never `NaN`
 */
function readMs(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** How often the browser polls a pending transaction's status, in milliseconds. */
export const POLL_INTERVAL_MS = readMs("MVOLA_POLL_INTERVAL_MS", 3000);

/**
 * How long the browser keeps polling before reporting "still pending" instead of failure.
 * This is a reporting boundary only — reaching it never mutates a wallet and never marks
 * a transaction failed; it may yet settle by callback afterwards (rule R3).
 */
export const POLL_TIMEOUT_MS = readMs("MVOLA_POLL_TIMEOUT_MS", 120000);
