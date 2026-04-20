# Story 07-01: Coin-Flip Pure Logic — `src/lib/game/coinflip.ts`

> **Epic:** 07 — Game & Wallet Queries
> **Size:** S
> **Status:** TODO

## Description

Create `src/lib/game/coinflip.ts` — a single pure function `playCoinFlip(bet, choice, rng?)` that returns `{ outcome, result, delta }`. The default RNG uses `crypto.getRandomValues` to read one byte and maps `< 128` to `"heads"`, `>= 128` to `"tails"`. Tests inject a deterministic RNG to force specific outcomes.

## Acceptance Criteria

- [ ] `playCoinFlip(bet: number, choice: GameChoice, rng?: () => GameChoice): CoinFlipOutcome` exported
- [ ] Throws `Error` if `bet` is not a positive integer
- [ ] `outcome` equals `rng()` when provided; default RNG uses `crypto.getRandomValues(new Uint8Array(1))[0] < 128 ? "heads" : "tails"`
- [ ] `result = outcome === choice ? "win" : "loss"`
- [ ] `delta = result === "win" ? bet : -bet`
- [ ] Return type exactly matches `CoinFlipOutcome` from `src/lib/mvola/types.ts`
- [ ] Function has **no side effects** — no store access, no I/O, no logging
- [ ] Unit tests: forced heads/win, forced heads/loss, forced tails/win, forced tails/loss, bet=0 throws, bet=-5 throws, bet=1.5 throws, default RNG produces both outcomes over many calls

## Technical Notes

```typescript
import { GameChoice, CoinFlipOutcome } from "@/lib/mvola/types";

type Rng = () => GameChoice;

const defaultRng: Rng = () => {
  const buf = new Uint8Array(1);
  crypto.getRandomValues(buf);
  return buf[0] < 128 ? "heads" : "tails";
};

export function playCoinFlip(bet: number, choice: GameChoice, rng: Rng = defaultRng): CoinFlipOutcome {
  if (!Number.isInteger(bet) || bet <= 0) {
    throw new Error(`bet must be a positive integer, got ${bet}`);
  }
  const outcome = rng();
  const result = outcome === choice ? "win" : "loss";
  const delta = result === "win" ? bet : -bet;
  return { outcome, result, delta };
}
```

Distribution test idea: call the default RNG 1000 times and assert both outcomes appear at least 400 times (generous tolerance, avoids flakiness).

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/game/coinflip.ts` | Pure coin-flip game logic |
| CREATE | `src/lib/game/__tests__/coinflip.test.ts` | Deterministic unit tests |

## Dependencies

- **Blocked by:** Story 05-01 (`GameChoice`, `CoinFlipOutcome`)
- **Blocks:** Story 07-02

## Related

- **Epic:** 07_game-and-queries
- **Spec reference:** `docs/architecture/components.md` § `src/lib/game/coinflip.ts`, `docs/architecture/tech-stack.md` § Game Simulation
