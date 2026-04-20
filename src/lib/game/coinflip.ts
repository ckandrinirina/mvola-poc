/**
 * Coin-Flip Pure Game Logic
 *
 * A single pure function with no side effects — no store access, no I/O,
 * no logging. The default RNG uses crypto.getRandomValues so it works in
 * both Node.js (≥19) and the browser.
 */

import type { GameChoice, CoinFlipOutcome } from "@/lib/mvola/types";

type Rng = () => GameChoice;

/**
 * Cryptographically random RNG. Maps byte < 128 → "heads", ≥ 128 → "tails".
 * Yields a uniform 50/50 distribution.
 */
const defaultRng: Rng = () => {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] < 128 ? "heads" : "tails";
};

/**
 * Play a single round of coin-flip.
 *
 * @param bet    - Wager amount in integer Ariary (must be a positive integer).
 * @param choice - The player's chosen side ("heads" | "tails").
 * @param rng    - Optional RNG override; defaults to crypto-backed uniform RNG.
 * @returns      CoinFlipOutcome with outcome, result, and delta.
 * @throws       {Error} if bet is not a positive integer.
 */
export function playCoinFlip(
  bet: number,
  choice: GameChoice,
  rng: Rng = defaultRng
): CoinFlipOutcome {
  if (!Number.isInteger(bet) || bet <= 0) {
    throw new Error(`bet must be a positive integer, got ${bet}`);
  }

  const outcome = rng();
  const result = outcome === choice ? "win" : "loss";
  const delta = result === "win" ? bet : -bet;

  return { outcome, result, delta };
}
