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
import { updateTransactionStatus } from "@/lib/store/transactions";

/**
 * Applies the MVola → wallet state transition for a single terminal status
 * update. Silently returns when the update is not a state-changing event.
 *
 * @param record          The local transaction record (lookup result from the store).
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

  // Guard 2 — idempotency: once reconciled, every subsequent call is a no-op.
  if (record.status !== "pending") return;

  // --- Deposit flow ---------------------------------------------------
  if (record.direction === "deposit") {
    if (newStatus === "completed" && !record.walletSettled) {
      creditWallet(record.msisdn, record.amount);
      updateTransactionStatus(record.localTxId, "completed", {
        walletSettled: true,
        mvolaReference,
      });
      return;
    }
    if (newStatus === "failed" && !record.walletSettled) {
      updateTransactionStatus(record.localTxId, "failed", {
        walletSettled: true,
        mvolaReference,
      });
      return;
    }
    return;
  }

  // --- Withdraw flow --------------------------------------------------
  if (record.direction === "withdraw") {
    if (newStatus === "completed") {
      updateTransactionStatus(record.localTxId, "completed", {
        mvolaReference,
      });
      return;
    }
    if (newStatus === "failed" && record.walletSettled) {
      creditWallet(record.msisdn, record.amount);
      updateTransactionStatus(record.localTxId, "failed", {
        walletSettled: false,
        mvolaReference,
      });
      return;
    }
  }
}
