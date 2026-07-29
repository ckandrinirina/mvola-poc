/**
 * MVola ↔ Wallet reconciliation helper.
 *
 * Shared between the status-polling route (`GET /api/mvola/status/...`)
 * and the asynchronous callback route (`PUT /api/mvola/callback`) so that
 * both entry points apply the same decision tree. The helper is idempotent:
 * once a record is reconciled (its `status` is no longer "pending") every
 * subsequent call becomes a no-op, preventing double credits or refunds.
 *
 * Truth table driven — see story 06-04:
 *
 * | direction | walletSettled | status  | new status | wallet action  | new walletSettled | new status |
 * |-----------|---------------|---------|------------|----------------|-------------------|------------|
 * | deposit   | false         | pending | completed  | credit +amount | true              | completed  |
 * | deposit   | false         | pending | failed     | no-op          | true              | failed     |
 * | withdraw  | true          | pending | completed  | no-op          | true              | completed  |
 * | withdraw  | true          | pending | failed     | refund +amount | false             | failed     |
 * | (any row) | anything else                        | no-op (idempotent)                                |
 */

import type { TransactionRecord, TransactionStatus } from "@/lib/mvola/types";
import { creditWallet } from "@/lib/store/wallets";
import {
  getTransactionById,
  updateTransactionStatus,
} from "@/lib/store/transactions";

/**
 * Applies the MVola → wallet state transition for a single terminal status
 * update. Silently returns when the update is not a state-changing event.
 *
 * The caller's `record` is treated as an *identifier only* — every decision is
 * made against a freshly-read copy from the transaction store. This is what
 * makes the idempotency guard sound under concurrency: the store is
 * copy-on-write (`updateTransactionStatus` writes a NEW object rather than
 * mutating in place), so a caller that captured the record before an `await`
 * holds a snapshot frozen at `status: "pending"` even after a concurrent
 * entry point has already settled the wallet. Trusting that snapshot would let
 * the same transaction credit (or refund) the wallet twice — see the race
 * described in `__tests__/reconcile.test.ts`.
 *
 * @param record          The local transaction record; only `localTxId` is
 *                        trusted, the rest is re-read from the store.
 * @param newStatus       The `transactionStatus` reported by MVola.
 * @param mvolaReference  Optional MVola-side reference; persisted on the
 *                        record when a mutation occurs so downstream consumers
 *                        can cross-reference the external transaction.
 */
export function reconcileTransaction(
  record: TransactionRecord,
  newStatus: TransactionStatus,
  mvolaReference?: string
): void {
  // Guard 1 — intermediate pollings (newStatus "pending") are ignored.
  if (newStatus !== "completed" && newStatus !== "failed") return;

  // Re-read the authoritative record: the caller's object may be a stale
  // pre-await snapshot. Defensive — the record may have vanished from the store.
  const current = getTransactionById(record.localTxId);
  if (current === undefined) return;

  // Guard 2 — idempotency: once reconciled, every subsequent call is a no-op.
  if (current.status !== "pending") return;

  // --- Deposit flow ---------------------------------------------------
  if (current.direction === "deposit") {
    if (newStatus === "completed" && !current.walletSettled) {
      creditWallet(current.msisdn, current.amount);
      updateTransactionStatus(current.localTxId, "completed", {
        walletSettled: true,
        mvolaReference,
      });
      return;
    }
    if (newStatus === "failed" && !current.walletSettled) {
      updateTransactionStatus(current.localTxId, "failed", {
        walletSettled: true,
        mvolaReference,
      });
      return;
    }
    return;
  }

  // --- Withdraw flow --------------------------------------------------
  if (current.direction === "withdraw") {
    if (newStatus === "completed") {
      updateTransactionStatus(current.localTxId, "completed", {
        mvolaReference,
      });
      return;
    }
    if (newStatus === "failed" && current.walletSettled) {
      creditWallet(current.msisdn, current.amount);
      updateTransactionStatus(current.localTxId, "failed", {
        walletSettled: false,
        mvolaReference,
      });
      return;
    }
  }
}
