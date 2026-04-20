# Story 05-04: Game Session Store — `src/lib/store/games.ts`

> **Epic:** 05 — State Store Layer
> **Size:** S
> **Status:** TODO

## Description

Create the game session store — an append-only in-memory log of every coin-flip round. Every round is immutable once recorded (there is no update or delete API). `listGameSessionsByMsisdn` returns rounds sorted newest-first and is used by the history route and the history UI component.

## Acceptance Criteria

- [ ] `recordGameSession(input): GameSession` where `input = { msisdn, bet, choice, outcome, result, delta, balanceAfter }`:
  - [ ] Generates `sessionId` via `crypto.randomUUID()`
  - [ ] Sets `playedAt = Date.now()`
  - [ ] Inserts into the primary map
  - [ ] Throws `Error` if `bet` or `balanceAfter` is not a non-negative integer (bet > 0; balanceAfter >= 0)
- [ ] `listGameSessionsByMsisdn(msisdn: string): GameSession[]` returns sessions sorted by `playedAt` descending
- [ ] `resetAll(): void` clears the map
- [ ] The underlying map is module-private
- [ ] No mutation API beyond `recordGameSession` and `resetAll`
- [ ] Unit tests cover: record, list order, multi-msisdn isolation, input validation

## Technical Notes

```typescript
import { GameSession, GameChoice, GameResult } from "@/lib/mvola/types";

const sessions = new Map<string, GameSession>();

interface RecordInput {
  msisdn: string;
  bet: number;
  choice: GameChoice;
  outcome: GameChoice;
  result: GameResult;
  delta: number;
  balanceAfter: number;
}

export function recordGameSession(input: RecordInput): GameSession {
  if (!Number.isInteger(input.bet) || input.bet <= 0) {
    throw new Error(`bet must be a positive integer, got ${input.bet}`);
  }
  if (!Number.isInteger(input.balanceAfter) || input.balanceAfter < 0) {
    throw new Error(`balanceAfter must be a non-negative integer`);
  }
  const session: GameSession = {
    sessionId: crypto.randomUUID(),
    playedAt: Date.now(),
    ...input,
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function listGameSessionsByMsisdn(msisdn: string): GameSession[] {
  return Array.from(sessions.values())
    .filter(s => s.msisdn === msisdn)
    .sort((a, b) => b.playedAt - a.playedAt);
}

export function resetAll(): void {
  sessions.clear();
}
```

Because rounds are append-only, you do not need to expose a getter-by-id.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/store/games.ts` | Append-only game session log |
| CREATE | `src/lib/store/__tests__/games.test.ts` | Unit tests |

## Dependencies

- **Blocked by:** Story 05-01 (`GameSession`, `GameChoice`, `GameResult`)
- **Blocks:** Stories 07-02, 07-04

## Related

- **Epic:** 05_state-store
- **Spec reference:** `docs/architecture/state-management.md` § `games.ts`
