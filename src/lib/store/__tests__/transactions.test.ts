import {
  createTransaction,
  getTransactionByCorrelationId,
  getTransactionById,
  updateTransactionStatus,
  listTransactionsByMsisdn,
  resetAll,
} from "../transactions";

beforeEach(() => {
  resetAll();
});

describe("createTransaction", () => {
  it("creates a transaction with pending status and correct fields", () => {
    const before = Date.now();
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 5000,
      correlationId: "corr-001",
      walletSettled: false,
    });
    const after = Date.now();

    expect(record.localTxId).toBeDefined();
    expect(record.correlationId).toBe("corr-001");
    expect(record.msisdn).toBe("0340000001");
    expect(record.direction).toBe("deposit");
    expect(record.amount).toBe(5000);
    expect(record.status).toBe("pending");
    expect(record.walletSettled).toBe(false);
    expect(record.mvolaReference).toBeUndefined();
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(record.createdAt).toBeLessThanOrEqual(after);
    expect(record.updatedAt).toBe(record.createdAt);
  });

  it("generates a unique localTxId (UUID format)", () => {
    const r1 = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-uuid-1",
      walletSettled: false,
    });
    const r2 = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 2000,
      correlationId: "corr-uuid-2",
      walletSettled: false,
    });
    expect(r1.localTxId).not.toBe(r2.localTxId);
    expect(r1.localTxId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it("throws if correlationId already exists", () => {
    createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "dup-corr",
      walletSettled: false,
    });
    expect(() =>
      createTransaction({
        msisdn: "0340000002",
        direction: "withdraw",
        amount: 2000,
        correlationId: "dup-corr",
        walletSettled: false,
      })
    ).toThrow(/duplicate correlationId/i);
  });

  it("throws if amount is zero", () => {
    expect(() =>
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: 0,
        correlationId: "corr-zero",
        walletSettled: false,
      })
    ).toThrow(/positive integer/i);
  });

  it("throws if amount is negative", () => {
    expect(() =>
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: -100,
        correlationId: "corr-neg",
        walletSettled: false,
      })
    ).toThrow(/positive integer/i);
  });

  it("throws if amount is a non-integer (float)", () => {
    expect(() =>
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: 99.5,
        correlationId: "corr-float",
        walletSettled: false,
      })
    ).toThrow(/positive integer/i);
  });
});

describe("getTransactionByCorrelationId", () => {
  it("returns the record when found", () => {
    const created = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-lookup",
      walletSettled: false,
    });
    const found = getTransactionByCorrelationId("corr-lookup");
    expect(found).toEqual(created);
  });

  it("returns undefined when not found", () => {
    expect(getTransactionByCorrelationId("nonexistent")).toBeUndefined();
  });
});

describe("getTransactionById", () => {
  it("returns the record when found", () => {
    const created = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-by-id",
      walletSettled: false,
    });
    const found = getTransactionById(created.localTxId);
    expect(found).toEqual(created);
  });

  it("returns undefined when not found", () => {
    expect(getTransactionById("nonexistent-id")).toBeUndefined();
  });
});

describe("updateTransactionStatus", () => {
  it("updates status and bumps updatedAt", async () => {
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-update",
      walletSettled: false,
    });

    // Force a tiny time gap so updatedAt > createdAt is observable
    await new Promise((r) => setTimeout(r, 2));

    const updated = updateTransactionStatus(record.localTxId, "completed");
    expect(updated.status).toBe("completed");
    expect(updated.updatedAt).toBeGreaterThanOrEqual(record.createdAt);
    expect(updated.localTxId).toBe(record.localTxId);
  });

  it("sets mvolaReference when provided in patch", () => {
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-patch-ref",
      walletSettled: false,
    });
    const updated = updateTransactionStatus(record.localTxId, "completed", {
      mvolaReference: "mvola-ref-123",
    });
    expect(updated.mvolaReference).toBe("mvola-ref-123");
  });

  it("sets walletSettled when provided in patch", () => {
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-patch-settled",
      walletSettled: false,
    });
    const updated = updateTransactionStatus(record.localTxId, "completed", {
      walletSettled: true,
    });
    expect(updated.walletSettled).toBe(true);
  });

  it("sets both mvolaReference and walletSettled simultaneously", () => {
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-patch-both",
      walletSettled: false,
    });
    const updated = updateTransactionStatus(record.localTxId, "completed", {
      mvolaReference: "mvola-ref-xyz",
      walletSettled: true,
    });
    expect(updated.mvolaReference).toBe("mvola-ref-xyz");
    expect(updated.walletSettled).toBe(true);
  });

  it("throws if the record does not exist", () => {
    expect(() =>
      updateTransactionStatus("no-such-id", "completed")
    ).toThrow(/not found/i);
  });
});

describe("listTransactionsByMsisdn", () => {
  it("returns transactions for a given msisdn sorted by createdAt descending", async () => {
    createTransaction({
      msisdn: "0340000010",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-list-1",
      walletSettled: false,
    });
    // Small delay to ensure distinct timestamps
    await new Promise((r) => setTimeout(r, 2));
    createTransaction({
      msisdn: "0340000010",
      direction: "withdraw",
      amount: 500,
      correlationId: "corr-list-2",
      walletSettled: true,
    });

    const list = listTransactionsByMsisdn("0340000010");
    expect(list).toHaveLength(2);
    expect(list[0].correlationId).toBe("corr-list-2"); // most recent first
    expect(list[1].correlationId).toBe("corr-list-1");
  });

  it("returns empty array for an unknown msisdn", () => {
    expect(listTransactionsByMsisdn("0340000099")).toEqual([]);
  });

  it("isolates transactions per msisdn", () => {
    createTransaction({
      msisdn: "0340000011",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-iso-1",
      walletSettled: false,
    });
    createTransaction({
      msisdn: "0340000012",
      direction: "deposit",
      amount: 2000,
      correlationId: "corr-iso-2",
      walletSettled: false,
    });

    const list11 = listTransactionsByMsisdn("0340000011");
    const list12 = listTransactionsByMsisdn("0340000012");
    expect(list11).toHaveLength(1);
    expect(list11[0].correlationId).toBe("corr-iso-1");
    expect(list12).toHaveLength(1);
    expect(list12[0].correlationId).toBe("corr-iso-2");
  });
});

describe("resetAll", () => {
  it("clears all records so subsequent lookups return undefined/empty", () => {
    const record = createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-reset",
      walletSettled: false,
    });
    resetAll();
    expect(getTransactionById(record.localTxId)).toBeUndefined();
    expect(getTransactionByCorrelationId("corr-reset")).toBeUndefined();
    expect(listTransactionsByMsisdn("0340000001")).toEqual([]);
  });

  it("allows creating a transaction with the same correlationId after reset", () => {
    createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-reuse",
      walletSettled: false,
    });
    resetAll();
    expect(() =>
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: 2000,
        correlationId: "corr-reuse",
        walletSettled: false,
      })
    ).not.toThrow();
  });
});
