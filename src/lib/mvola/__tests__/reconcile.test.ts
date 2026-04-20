/**
 * Tests for reconcileTransaction() — src/lib/mvola/reconcile.ts
 *
 * Exercises every row of the truth table documented in story 06-04 plus
 * idempotency (same input applied twice performs a single mutation).
 *
 * | direction | walletSettled | current status | new status | wallet action | new walletSettled | new status |
 * |-----------|---------------|----------------|------------|---------------|-------------------|------------|
 * | deposit   | false         | pending        | completed  | credit +amt   | true              | completed  |
 * | deposit   | false         | pending        | failed     | no-op         | true              | failed     |
 * | deposit   | true          | any            | any        | no-op         | true              | unchanged  |
 * | withdraw  | true          | pending        | completed  | no-op         | true              | completed  |
 * | withdraw  | true          | pending        | failed     | refund +amt   | false             | failed     |
 * | withdraw  | false         | failed         | any        | no-op         | false             | unchanged  |
 */

import { reconcileTransaction } from "../reconcile";
import {
  createTransaction,
  getTransactionById,
  resetAll as resetTransactions,
} from "@/lib/store/transactions";
import {
  getWallet,
  creditWallet,
  resetAll as resetWallets,
} from "@/lib/store/wallets";
import type { TransactionRecord } from "@/lib/mvola/types";

beforeEach(() => {
  resetTransactions();
  resetWallets();
});

// --- Helpers -----------------------------------------------------------

function makeDeposit(
  msisdn: string,
  amount: number,
  correlationId: string
): TransactionRecord {
  return createTransaction({
    msisdn,
    direction: "deposit",
    amount,
    correlationId,
    walletSettled: false,
  });
}

function makeWithdraw(
  msisdn: string,
  amount: number,
  correlationId: string
): TransactionRecord {
  // Withdraw flow reserves funds up-front: wallet is debited and
  // walletSettled starts at `true` (settled optimistically).
  return createTransaction({
    msisdn,
    direction: "withdraw",
    amount,
    correlationId,
    walletSettled: true,
  });
}

// --- Truth table: deposit rows -----------------------------------------

describe("reconcileTransaction — deposit", () => {
  it("credits the wallet, marks walletSettled=true and status=completed on first completed poll", () => {
    const msisdn = "0340000001";
    const amount = 5000;
    const record = makeDeposit(msisdn, amount, "corr-dep-complete");

    reconcileTransaction(record, "completed", "mvola-ref-1");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.status).toBe("completed");
    expect(updated.walletSettled).toBe(true);
    expect(updated.mvolaReference).toBe("mvola-ref-1");
    expect(getWallet(msisdn)?.balance).toBe(amount);
  });

  it("does NOT credit the wallet when the deposit fails, but still flips status and walletSettled", () => {
    const msisdn = "0340000002";
    const record = makeDeposit(msisdn, 3000, "corr-dep-fail");

    reconcileTransaction(record, "failed");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.status).toBe("failed");
    expect(updated.walletSettled).toBe(true);
    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
  });

  it("is idempotent: second completed poll does not double-credit the wallet", () => {
    const msisdn = "0340000003";
    const amount = 7000;
    const record = makeDeposit(msisdn, amount, "corr-dep-idem");

    reconcileTransaction(record, "completed");
    const firstUpdate = getTransactionById(record.localTxId)!;

    // Simulate a repeat poll — the helper must short-circuit.
    reconcileTransaction(firstUpdate, "completed");

    expect(getWallet(msisdn)?.balance).toBe(amount);
    expect(getTransactionById(record.localTxId)!.status).toBe("completed");
  });

  it("is idempotent: second failed poll does not re-run the transition", () => {
    const msisdn = "0340000004";
    const record = makeDeposit(msisdn, 2000, "corr-dep-fail-idem");

    reconcileTransaction(record, "failed");
    const firstUpdate = getTransactionById(record.localTxId)!;

    // Simulate the MVola status endpoint returning "failed" a second time.
    reconcileTransaction(firstUpdate, "failed");

    expect(getTransactionById(record.localTxId)!.status).toBe("failed");
    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
  });

  it("does nothing for the pending status (intermediate poll)", () => {
    const msisdn = "0340000005";
    const record = makeDeposit(msisdn, 1000, "corr-dep-pending");

    reconcileTransaction(record, "pending");

    const after = getTransactionById(record.localTxId)!;
    expect(after.status).toBe("pending");
    expect(after.walletSettled).toBe(false);
    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
  });
});

// --- Truth table: withdraw rows ----------------------------------------

describe("reconcileTransaction — withdraw", () => {
  it("leaves the wallet untouched on successful withdraw, only updates status", () => {
    const msisdn = "0340000010";
    const amount = 4000;

    // Simulate the post-debit state the withdraw route leaves behind:
    // the wallet was already reduced by `amount` and walletSettled is true.
    creditWallet(msisdn, 10000 - amount);
    const record = makeWithdraw(msisdn, amount, "corr-wit-complete");

    const balanceBefore = getWallet(msisdn)!.balance;

    reconcileTransaction(record, "completed", "mvola-ref-w1");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.status).toBe("completed");
    expect(updated.walletSettled).toBe(true);
    expect(updated.mvolaReference).toBe("mvola-ref-w1");
    expect(getWallet(msisdn)!.balance).toBe(balanceBefore);
  });

  it("refunds the wallet on failed withdraw and flips walletSettled=false", () => {
    const msisdn = "0340000011";
    const amount = 3000;

    // Pre-debited wallet (settled=true means balance is already reduced)
    creditWallet(msisdn, 10000 - amount);
    const balanceBefore = getWallet(msisdn)!.balance;

    const record = makeWithdraw(msisdn, amount, "corr-wit-fail");

    reconcileTransaction(record, "failed", "mvola-ref-w2");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.status).toBe("failed");
    expect(updated.walletSettled).toBe(false);
    expect(updated.mvolaReference).toBe("mvola-ref-w2");
    expect(getWallet(msisdn)!.balance).toBe(balanceBefore + amount);
  });

  it("is idempotent: second failed poll does not double-refund", () => {
    const msisdn = "0340000012";
    const amount = 2500;

    creditWallet(msisdn, 10000 - amount);
    const balanceBefore = getWallet(msisdn)!.balance;

    const record = makeWithdraw(msisdn, amount, "corr-wit-fail-idem");

    reconcileTransaction(record, "failed");
    const firstUpdate = getTransactionById(record.localTxId)!;

    // Repeat poll — must be a no-op because record.status is already "failed".
    reconcileTransaction(firstUpdate, "failed");

    expect(getWallet(msisdn)!.balance).toBe(balanceBefore + amount);
    expect(getTransactionById(record.localTxId)!.walletSettled).toBe(false);
  });

  it("is idempotent: second completed poll on a happy withdraw does nothing", () => {
    const msisdn = "0340000013";
    const amount = 1500;

    creditWallet(msisdn, 10000 - amount);
    const balanceBefore = getWallet(msisdn)!.balance;

    const record = makeWithdraw(msisdn, amount, "corr-wit-complete-idem");

    reconcileTransaction(record, "completed");
    const firstUpdate = getTransactionById(record.localTxId)!;

    reconcileTransaction(firstUpdate, "completed");

    expect(getWallet(msisdn)!.balance).toBe(balanceBefore);
    expect(getTransactionById(record.localTxId)!.status).toBe("completed");
  });

  it("does nothing for the pending status", () => {
    const msisdn = "0340000014";
    const amount = 1000;
    creditWallet(msisdn, 10000 - amount);
    const balanceBefore = getWallet(msisdn)!.balance;

    const record = makeWithdraw(msisdn, amount, "corr-wit-pending");

    reconcileTransaction(record, "pending");

    expect(getTransactionById(record.localTxId)!.status).toBe("pending");
    expect(getWallet(msisdn)!.balance).toBe(balanceBefore);
  });
});

// --- mvolaReference propagation & optional arg -------------------------

describe("reconcileTransaction — mvolaReference optional arg", () => {
  it("does not overwrite mvolaReference when the arg is omitted", () => {
    const msisdn = "0340000020";
    const record = makeDeposit(msisdn, 1000, "corr-no-ref");

    reconcileTransaction(record, "completed");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.mvolaReference).toBeUndefined();
    expect(updated.status).toBe("completed");
  });
});
