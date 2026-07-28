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
  getTransactionByCorrelationId,
  getTransactionByMvolaReference,
  updateTransactionStatus,
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

    reconcileTransaction(record, "failed", "mvola-ref-dep-fail");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.status).toBe("failed");
    expect(updated.walletSettled).toBe(true);
    expect(updated.mvolaReference).toBe("mvola-ref-dep-fail");
    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
    expect(getTransactionByMvolaReference("mvola-ref-dep-fail")?.localTxId).toBe(
      record.localTxId
    );
  });

  it("is idempotent: second completed poll does not double-credit the wallet", () => {
    const msisdn = "0340000003";
    const amount = 7000;
    const record = makeDeposit(msisdn, amount, "corr-dep-idem");

    reconcileTransaction(record, "completed", "mvola-ref-idem-1");
    const firstUpdate = getTransactionById(record.localTxId)!;

    // Simulate a repeat poll — the helper must short-circuit and never re-index.
    reconcileTransaction(firstUpdate, "completed", "mvola-ref-idem-2");

    expect(getWallet(msisdn)?.balance).toBe(amount);
    expect(getTransactionById(record.localTxId)!.status).toBe("completed");
    expect(getTransactionById(record.localTxId)!.mvolaReference).toBe(
      "mvola-ref-idem-1"
    );
    expect(
      getTransactionByMvolaReference("mvola-ref-idem-1")?.localTxId
    ).toBe(record.localTxId);
    expect(getTransactionByMvolaReference("mvola-ref-idem-2")).toBeUndefined();
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

// --- Concurrency: stale-snapshot race between poll and callback --------

/**
 * The status route (`GET /api/mvola/status/[correlationId]`) captures the
 * local record BEFORE two awaits (`getToken()` then `getTransactionStatus()`)
 * and only then calls `reconcileTransaction`. Because the transaction store is
 * copy-on-write, that captured object is a *stale snapshot*: a callback for the
 * same transaction that settles the wallet while the poll is suspended writes a
 * brand-new object into the store, leaving the poll's reference frozen at
 * `status: "pending"` / `walletSettled: false`.
 *
 * `reconcileTransaction` must therefore derive its idempotency guard from the
 * authoritative record in the store, not from the caller's snapshot.
 */
describe("reconcileTransaction — stale snapshot race (poll vs callback)", () => {
  it("credits a deposit exactly once when the callback settles while the status poll is suspended", async () => {
    const msisdn = "0340000030";
    const amount = 6000;
    const correlationId = "corr-race-deposit";
    const record = makeDeposit(msisdn, amount, correlationId);

    // Status route: snapshots the record, then yields at its two awaits.
    const statusPoll = (async () => {
      const snapshot = getTransactionByCorrelationId(correlationId)!;
      expect(snapshot.status).toBe("pending");
      await Promise.resolve(); // suspends at `await getToken()`
      await Promise.resolve(); // suspends at `await getTransactionStatus()`
      reconcileTransaction(snapshot, "completed", "mvola-ref-race-poll");
    })();

    // Callback route wins the race: it reads its own FRESH copy and settles.
    reconcileTransaction(
      getTransactionByCorrelationId(correlationId)!,
      "completed",
      "mvola-ref-race-callback"
    );
    expect(getWallet(msisdn)?.balance).toBe(amount);

    // Status poll resumes holding the now-stale "pending" object.
    await statusPoll;

    // Exactly ONE credit — not two.
    expect(getWallet(msisdn)?.balance).toBe(amount);

    const settled = getTransactionById(record.localTxId)!;
    expect(settled.status).toBe("completed");
    expect(settled.walletSettled).toBe(true);
    // The losing poll must not have re-indexed its own reference either.
    expect(settled.mvolaReference).toBe("mvola-ref-race-callback");
    expect(getTransactionByMvolaReference("mvola-ref-race-poll")).toBeUndefined();
  });

  it("refunds a failed withdraw exactly once when the callback refunds while the status poll is suspended", async () => {
    const msisdn = "0340000031";
    const amount = 3500;
    const correlationId = "corr-race-withdraw";

    // Pre-debited wallet: walletSettled=true means the balance is already reduced.
    creditWallet(msisdn, 10000 - amount);
    const balanceBefore = getWallet(msisdn)!.balance;

    const record = makeWithdraw(msisdn, amount, correlationId);

    const statusPoll = (async () => {
      const snapshot = getTransactionByCorrelationId(correlationId)!;
      expect(snapshot.status).toBe("pending");
      expect(snapshot.walletSettled).toBe(true);
      await Promise.resolve();
      await Promise.resolve();
      reconcileTransaction(snapshot, "failed", "mvola-ref-race-poll-w");
    })();

    reconcileTransaction(
      getTransactionByCorrelationId(correlationId)!,
      "failed",
      "mvola-ref-race-callback-w"
    );
    expect(getWallet(msisdn)!.balance).toBe(balanceBefore + amount);

    await statusPoll;

    // Exactly ONE refund — not two.
    expect(getWallet(msisdn)!.balance).toBe(balanceBefore + amount);

    const settled = getTransactionById(record.localTxId)!;
    expect(settled.status).toBe("failed");
    expect(settled.walletSettled).toBe(false);
    expect(settled.mvolaReference).toBe("mvola-ref-race-callback-w");
  });

  it("does not settle twice when a deposit poll resumes with a snapshot that failed meanwhile", async () => {
    const msisdn = "0340000032";
    const amount = 2200;
    const correlationId = "corr-race-mixed";
    const record = makeDeposit(msisdn, amount, correlationId);

    const staleSnapshot = getTransactionByCorrelationId(correlationId)!;
    await Promise.resolve();

    // Callback marks the deposit FAILED (no credit).
    reconcileTransaction(
      getTransactionByCorrelationId(correlationId)!,
      "failed",
      "mvola-ref-mixed-callback"
    );

    // Stale poll resumes believing it is still pending and reports "completed".
    // It must not resurrect the record nor credit the wallet.
    reconcileTransaction(staleSnapshot, "completed", "mvola-ref-mixed-poll");

    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
    const settled = getTransactionById(record.localTxId)!;
    expect(settled.status).toBe("failed");
    expect(settled.mvolaReference).toBe("mvola-ref-mixed-callback");
  });

  it("returns without throwing when the record no longer exists in the store", () => {
    const msisdn = "0340000033";
    const record = makeDeposit(msisdn, 1000, "corr-race-vanished");

    // Simulate a record the caller holds but the store no longer knows about.
    resetTransactions();

    expect(() =>
      reconcileTransaction(record, "completed", "mvola-ref-vanished")
    ).not.toThrow();
    expect(getWallet(msisdn)?.balance ?? 0).toBe(0);
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

  it("leaves a previously stored mvolaReference intact when the first terminal poll omits it", () => {
    const msisdn = "0340000021";
    const record = makeDeposit(msisdn, 1000, "corr-pre-ref");

    // Simulate a reference already recorded on the still-pending record
    // (e.g. attached out-of-band before the terminal poll arrives).
    const preSeeded = getTransactionById(
      updateTransactionStatus(record.localTxId, "pending", {
        mvolaReference: "mvola-ref-preseeded",
      }).localTxId
    )!;

    reconcileTransaction(preSeeded, "completed");

    const updated = getTransactionById(record.localTxId)!;
    expect(updated.mvolaReference).toBe("mvola-ref-preseeded");
    expect(updated.status).toBe("completed");
    expect(
      getTransactionByMvolaReference("mvola-ref-preseeded")?.localTxId
    ).toBe(record.localTxId);
  });
});
