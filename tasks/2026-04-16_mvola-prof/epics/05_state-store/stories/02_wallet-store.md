# Story 05-02: Wallet Store — `src/lib/store/wallets.ts`

> **Epic:** 05 — State Store Layer
> **Size:** M
> **Status:** DONE

## Description

Create the wallet store — a module-level `Map<string, WalletState>` with typed accessor functions. This is the canonical balance for each player, keyed by MSISDN. Every debit path first checks the balance and throws `InsufficientFundsError` if insufficient, so the balance invariant `>= 0` is enforced at the store boundary.

## Acceptance Criteria

- [x] `getWallet(msisdn: string): WalletState | undefined` returns the stored wallet or `undefined`
- [x] `ensureWallet(msisdn: string): WalletState` returns an existing wallet or creates a zero-balance one (idempotent)
- [x] `creditWallet(msisdn: string, amount: number): WalletState`:
  - [x] Creates a wallet via `ensureWallet` if missing
  - [x] Increments `balance` by `amount` and bumps `updatedAt`
  - [x] Throws `Error` (not `InsufficientFundsError`) if `amount <= 0` or not an integer
- [x] `debitWallet(msisdn: string, amount: number): WalletState`:
  - [x] Throws `InsufficientFundsError` when the wallet doesn't exist or `balance < amount`
  - [x] Otherwise decrements `balance` by `amount` and bumps `updatedAt`
  - [x] Throws `Error` if `amount <= 0` or not an integer
- [x] `resetAll(): void` clears the map — test-only helper, callable from jest `beforeEach`
- [x] The underlying `Map` is module-private and NOT exported
- [x] Unit tests cover: empty-lookup, ensureWallet creates once and is idempotent, credit from empty, credit-then-debit, overdraft throws `InsufficientFundsError` with expected payload, non-integer/negative rejection, resetAll
- [x] Tests live in `src/lib/store/__tests__/wallets.test.ts` and pass under the existing jest config

## Technical Notes

Pattern mirrors `src/lib/mvola/auth.ts` — single module-level variable, synchronous accessors. No `await` anywhere in this module; the whole file is synchronous so that a caller can "check balance, then debit" atomically in a single event-loop tick.

Skeleton:

```typescript
import { WalletState, InsufficientFundsError } from "@/lib/mvola/types";

const wallets = new Map<string, WalletState>();

function assertPositiveInteger(n: number, label: string): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer, got ${n}`);
  }
}

export function getWallet(msisdn: string): WalletState | undefined {
  return wallets.get(msisdn);
}

export function ensureWallet(msisdn: string): WalletState {
  const existing = wallets.get(msisdn);
  if (existing) return existing;
  const now = Date.now();
  const fresh: WalletState = { msisdn, balance: 0, createdAt: now, updatedAt: now };
  wallets.set(msisdn, fresh);
  return fresh;
}

export function creditWallet(msisdn: string, amount: number): WalletState {
  assertPositiveInteger(amount, "amount");
  const w = ensureWallet(msisdn);
  w.balance += amount;
  w.updatedAt = Date.now();
  return w;
}

export function debitWallet(msisdn: string, amount: number): WalletState {
  assertPositiveInteger(amount, "amount");
  const w = wallets.get(msisdn);
  const current = w?.balance ?? 0;
  if (current < amount) {
    throw new InsufficientFundsError(current, amount);
  }
  w!.balance -= amount;
  w!.updatedAt = Date.now();
  return w!;
}

export function resetAll(): void {
  wallets.clear();
}
```

Test the invariant that `balance` never goes negative by asserting the throw on overdraft, then asserting `getWallet(msisdn).balance` is unchanged after the failed debit.

## Files to Create/Modify

| Action | File Path | Purpose |
|--------|-----------|---------|
| CREATE | `src/lib/store/wallets.ts` | Module-level wallet store with typed accessors |
| CREATE | `src/lib/store/__tests__/wallets.test.ts` | Unit tests for all accessors |

## Dependencies

- **Blocked by:** Story 05-01 (`WalletState`, `InsufficientFundsError`)
- **Blocks:** Stories 06-02, 06-03, 06-04, 06-05, 07-02, 07-03, 08-01 (balance route + UI header both read this store)

## Related

- **Epic:** 05_state-store
- **Spec reference:** `docs/architecture/state-management.md` § `wallets.ts`
