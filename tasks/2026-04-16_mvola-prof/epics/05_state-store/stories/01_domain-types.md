# Story 05-01: Domain Type Extensions — `src/lib/mvola/types.ts`

> **Epic:** 05 — State Store Layer
> **Size:** S
> **Status:** DONE

## Description

Extend the existing `src/lib/mvola/types.ts` with the domain types required by the wallet, transaction, and game features. This includes `WalletState`, `TransactionRecord`, `GameSession`, their supporting unions, and an `InsufficientFundsError` class. All existing MVola payload types remain untouched — new types are appended to the same file to keep the single-source-of-truth convention from Epic 02.

## Acceptance Criteria

- [x] `TransactionDirection` exported as `"deposit" | "withdraw"`
- [x] `WalletState` exported with `msisdn: string`, `balance: number`, `createdAt: number`, `updatedAt: number`
- [x] `TransactionRecord` exported with `localTxId`, `correlationId`, `msisdn`, `direction` (`TransactionDirection`), `amount: number`, `status` (`TransactionStatus`), `walletSettled: boolean`, `mvolaReference?: string`, `createdAt`, `updatedAt`
- [x] `GameChoice` exported as `"heads" | "tails"`
- [x] `GameResult` exported as `"win" | "loss"`
- [x] `GameSession` exported with `sessionId`, `msisdn`, `bet: number`, `choice`, `outcome`, `result`, `delta: number`, `balanceAfter: number`, `playedAt: number`
- [x] `CoinFlipOutcome` exported as `{ outcome: GameChoice; result: GameResult; delta: number }`
- [x] `InsufficientFundsError` exported as a class extending `Error`, with `name = "InsufficientFundsError"` and an optional `{ balance: number; requested: number }` payload
- [x] Existing MVola types (`MVolaToken`, `WithdrawalRequest`, `TransactionResponse`, `CallbackPayload`, `TransactionStatus`, `MVolaParty`) remain unchanged
- [x] `npm run build` and the test suite pass with no TypeScript errors

## Technical Notes

All monetary fields are integer Ariary (`number`). The string representation used in the MVola HTTP layer stays confined to `src/lib/mvola/client.ts` — the conversion happens at the network boundary.

Suggested placement in the file:

```typescript
// --- Existing MVola types (unchanged) ---
// ... MVolaToken, WithdrawalRequest, TransactionStatus, etc.

// --- Domain types (new) ---

export type TransactionDirection = "deposit" | "withdraw";

export interface WalletState {
  msisdn: string;
  balance: number;       // integer Ariary, always >= 0
  createdAt: number;
  updatedAt: number;
}

export interface TransactionRecord {
  localTxId: string;
  correlationId: string;
  msisdn: string;
  direction: TransactionDirection;
  amount: number;
  status: TransactionStatus;
  walletSettled: boolean;
  mvolaReference?: string;
  createdAt: number;
  updatedAt: number;
}

export type GameChoice = "heads" | "tails";
export type GameResult = "win" | "loss";

export interface GameSession {
  sessionId: string;
  msisdn: string;
  bet: number;
  choice: GameChoice;
  outcome: GameChoice;
  result: GameResult;
  delta: number;         // +bet on win, -bet on loss
  balanceAfter: number;
  playedAt: number;
}

export interface CoinFlipOutcome {
  outcome: GameChoice;
  result: GameResult;
  delta: number;
}

export class InsufficientFundsError extends Error {
  public readonly balance: number;
  public readonly requested: number;
  constructor(balance: number, requested: number) {
    super(`Insufficient funds: balance=${balance}, requested=${requested}`);
    this.name = "InsufficientFundsError";
    this.balance = balance;
    this.requested = requested;
  }
}
```

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| MODIFY | `src/lib/mvola/types.ts` | Append all new domain types and the error class |

## Dependencies

- **Blocked by:** None
- **Blocks:** Stories 05-02, 05-03, 05-04, 06-01, 07-01 (and transitively all feature work)

## Related

- **Epic:** 05_state-store
- **Spec reference:** `docs/architecture/state-management.md` § Schemas; `docs/architecture/components.md` § `src/lib/mvola/types.ts`
