import {
  getWallet,
  ensureWallet,
  creditWallet,
  debitWallet,
  resetAll,
} from "@/lib/store/wallets";
import { InsufficientFundsError } from "@/lib/mvola/types";

const MSISDN = "0340000001";
const MSISDN_2 = "0340000002";

beforeEach(() => {
  resetAll();
});

describe("getWallet", () => {
  it("returns undefined for an unknown MSISDN", () => {
    expect(getWallet(MSISDN)).toBeUndefined();
  });

  it("returns the wallet after it has been created", () => {
    ensureWallet(MSISDN);
    const w = getWallet(MSISDN);
    expect(w).toBeDefined();
    expect(w!.msisdn).toBe(MSISDN);
    expect(w!.balance).toBe(0);
  });
});

describe("ensureWallet", () => {
  it("creates a zero-balance wallet on first call", () => {
    const w = ensureWallet(MSISDN);
    expect(w.msisdn).toBe(MSISDN);
    expect(w.balance).toBe(0);
    expect(w.createdAt).toBeGreaterThan(0);
    expect(w.updatedAt).toBeGreaterThan(0);
  });

  it("is idempotent — second call returns the same object", () => {
    const first = ensureWallet(MSISDN);
    const second = ensureWallet(MSISDN);
    expect(second).toBe(first);
  });

  it("does not affect other MSISDNs", () => {
    ensureWallet(MSISDN);
    expect(getWallet(MSISDN_2)).toBeUndefined();
  });
});

describe("creditWallet", () => {
  it("creates a wallet and credits it from empty", () => {
    const w = creditWallet(MSISDN, 500);
    expect(w.balance).toBe(500);
  });

  it("accumulates credits on successive calls", () => {
    creditWallet(MSISDN, 300);
    creditWallet(MSISDN, 200);
    expect(getWallet(MSISDN)!.balance).toBe(500);
  });

  it("bumps updatedAt after credit", () => {
    const before = Date.now();
    const w = creditWallet(MSISDN, 100);
    expect(w.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("throws Error when amount is zero", () => {
    expect(() => creditWallet(MSISDN, 0)).toThrow(Error);
  });

  it("throws Error when amount is negative", () => {
    expect(() => creditWallet(MSISDN, -1)).toThrow(Error);
  });

  it("throws Error when amount is a non-integer", () => {
    expect(() => creditWallet(MSISDN, 1.5)).toThrow(Error);
  });
});

describe("debitWallet", () => {
  it("decrements balance after a credit-then-debit", () => {
    creditWallet(MSISDN, 1000);
    const w = debitWallet(MSISDN, 400);
    expect(w.balance).toBe(600);
  });

  it("bumps updatedAt after debit", () => {
    creditWallet(MSISDN, 100);
    const before = Date.now();
    const w = debitWallet(MSISDN, 100);
    expect(w.updatedAt).toBeGreaterThanOrEqual(before);
  });

  it("throws InsufficientFundsError when wallet does not exist", () => {
    expect(() => debitWallet(MSISDN, 100)).toThrow(InsufficientFundsError);
  });

  it("throws InsufficientFundsError when balance is less than amount", () => {
    creditWallet(MSISDN, 50);
    expect(() => debitWallet(MSISDN, 100)).toThrow(InsufficientFundsError);
  });

  it("InsufficientFundsError carries correct balance and requested fields", () => {
    creditWallet(MSISDN, 50);
    try {
      debitWallet(MSISDN, 100);
      fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(InsufficientFundsError);
      const e = err as InsufficientFundsError;
      expect(e.balance).toBe(50);
      expect(e.requested).toBe(100);
    }
  });

  it("balance is unchanged after a failed overdraft debit", () => {
    creditWallet(MSISDN, 50);
    expect(() => debitWallet(MSISDN, 100)).toThrow(InsufficientFundsError);
    expect(getWallet(MSISDN)!.balance).toBe(50);
  });

  it("throws Error when amount is zero", () => {
    creditWallet(MSISDN, 100);
    expect(() => debitWallet(MSISDN, 0)).toThrow(Error);
  });

  it("throws Error when amount is negative", () => {
    creditWallet(MSISDN, 100);
    expect(() => debitWallet(MSISDN, -1)).toThrow(Error);
  });

  it("throws Error when amount is a non-integer", () => {
    creditWallet(MSISDN, 100);
    expect(() => debitWallet(MSISDN, 1.5)).toThrow(Error);
  });

  it("balance never goes negative — exact zero is allowed", () => {
    creditWallet(MSISDN, 100);
    const w = debitWallet(MSISDN, 100);
    expect(w.balance).toBe(0);
  });
});

describe("resetAll", () => {
  it("clears all wallets so getWallet returns undefined", () => {
    ensureWallet(MSISDN);
    ensureWallet(MSISDN_2);
    resetAll();
    expect(getWallet(MSISDN)).toBeUndefined();
    expect(getWallet(MSISDN_2)).toBeUndefined();
  });

  it("allows wallets to be recreated fresh after reset", () => {
    creditWallet(MSISDN, 999);
    resetAll();
    const w = ensureWallet(MSISDN);
    expect(w.balance).toBe(0);
  });
});
