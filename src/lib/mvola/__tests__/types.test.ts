/**
 * Tests for domain type extensions in src/lib/mvola/types.ts — Story 05-01
 *
 * Covers:
 * - TransactionDirection union type
 * - WalletState interface shape
 * - TransactionRecord interface shape
 * - GameChoice union type
 * - GameResult union type
 * - GameSession interface shape
 * - CoinFlipOutcome interface shape
 * - InsufficientFundsError class behaviour
 * - Existing MVola types remain unchanged
 */

import {
  InsufficientFundsError,
  TransactionStatus,
  MVolaParty,
  MVolaToken,
  WithdrawalRequest,
  CallbackPayload,
} from "../types";

import type {
  TransactionDirection,
  WalletState,
  TransactionRecord,
  GameChoice,
  GameResult,
  GameSession,
  CoinFlipOutcome,
} from "../types";

// ---------------------------------------------------------------------------
// InsufficientFundsError — runtime class (can be tested at runtime)
// ---------------------------------------------------------------------------

describe("InsufficientFundsError", () => {
  it("is an instance of Error", () => {
    const err = new InsufficientFundsError(100, 200);
    expect(err).toBeInstanceOf(Error);
  });

  it("has name = 'InsufficientFundsError'", () => {
    const err = new InsufficientFundsError(100, 200);
    expect(err.name).toBe("InsufficientFundsError");
  });

  it("carries balance and requested fields", () => {
    const err = new InsufficientFundsError(50, 150);
    expect(err.balance).toBe(50);
    expect(err.requested).toBe(150);
  });

  it("has a descriptive message", () => {
    const err = new InsufficientFundsError(50, 150);
    expect(err.message).toContain("50");
    expect(err.message).toContain("150");
  });

  it("can be caught as an Error", () => {
    expect(() => {
      throw new InsufficientFundsError(0, 10);
    }).toThrow(Error);
  });
});

// ---------------------------------------------------------------------------
// TransactionStatus — existing type still exported (unchanged)
// ---------------------------------------------------------------------------

describe("TransactionStatus (existing type unchanged)", () => {
  it("accepts 'pending'", () => {
    const status: TransactionStatus = "pending";
    expect(status).toBe("pending");
  });

  it("accepts 'completed'", () => {
    const status: TransactionStatus = "completed";
    expect(status).toBe("completed");
  });

  it("accepts 'failed'", () => {
    const status: TransactionStatus = "failed";
    expect(status).toBe("failed");
  });
});

// ---------------------------------------------------------------------------
// Structural / compile-time type tests
// (TypeScript compilation itself is the assertion; runtime values are checked
//  via assignability to typed variables.)
// ---------------------------------------------------------------------------

describe("TransactionDirection type", () => {
  it("accepts 'deposit'", () => {
    const dir: TransactionDirection = "deposit";
    expect(dir).toBe("deposit");
  });

  it("accepts 'withdraw'", () => {
    const dir: TransactionDirection = "withdraw";
    expect(dir).toBe("withdraw");
  });
});

describe("WalletState interface", () => {
  it("accepts a valid wallet state object", () => {
    const wallet: WalletState = {
      msisdn: "0340000000",
      balance: 10000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(wallet.msisdn).toBe("0340000000");
    expect(wallet.balance).toBe(10000);
    expect(typeof wallet.createdAt).toBe("number");
    expect(typeof wallet.updatedAt).toBe("number");
  });
});

describe("TransactionRecord interface", () => {
  it("accepts a valid transaction record without mvolaReference", () => {
    const record: TransactionRecord = {
      localTxId: "tx-001",
      correlationId: "corr-001",
      msisdn: "0340000000",
      direction: "withdraw",
      amount: 5000,
      status: "pending",
      walletSettled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(record.localTxId).toBe("tx-001");
    expect(record.walletSettled).toBe(false);
    expect(record.mvolaReference).toBeUndefined();
  });

  it("accepts a valid transaction record with mvolaReference", () => {
    const record: TransactionRecord = {
      localTxId: "tx-002",
      correlationId: "corr-002",
      msisdn: "0340000000",
      direction: "deposit",
      amount: 2000,
      status: "completed",
      walletSettled: true,
      mvolaReference: "mvola-ref-xyz",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    expect(record.mvolaReference).toBe("mvola-ref-xyz");
  });
});

describe("GameChoice type", () => {
  it("accepts 'heads'", () => {
    const choice: GameChoice = "heads";
    expect(choice).toBe("heads");
  });

  it("accepts 'tails'", () => {
    const choice: GameChoice = "tails";
    expect(choice).toBe("tails");
  });
});

describe("GameResult type", () => {
  it("accepts 'win'", () => {
    const result: GameResult = "win";
    expect(result).toBe("win");
  });

  it("accepts 'loss'", () => {
    const result: GameResult = "loss";
    expect(result).toBe("loss");
  });
});

describe("GameSession interface", () => {
  it("accepts a valid game session object", () => {
    const session: GameSession = {
      sessionId: "sess-001",
      msisdn: "0340000000",
      bet: 1000,
      choice: "heads",
      outcome: "tails",
      result: "loss",
      delta: -1000,
      balanceAfter: 9000,
      playedAt: Date.now(),
    };
    expect(session.sessionId).toBe("sess-001");
    expect(session.result).toBe("loss");
    expect(session.delta).toBe(-1000);
  });
});

describe("CoinFlipOutcome interface", () => {
  it("accepts a valid coin flip outcome", () => {
    const outcome: CoinFlipOutcome = {
      outcome: "heads",
      result: "win",
      delta: 500,
    };
    expect(outcome.outcome).toBe("heads");
    expect(outcome.result).toBe("win");
    expect(outcome.delta).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Existing MVola types — smoke check they are still importable and usable
// ---------------------------------------------------------------------------

describe("Existing MVola types remain accessible", () => {
  it("MVolaParty can be constructed", () => {
    const party: MVolaParty = { key: "msisdn", value: "0340000000" };
    expect(party.key).toBe("msisdn");
  });

  it("MVolaToken shape is intact", () => {
    const token: MVolaToken = {
      access_token: "abc",
      scope: "EXT_INT_MVOLA_SCOPE",
      token_type: "Bearer",
      expires_in: 3600,
    };
    expect(token.token_type).toBe("Bearer");
  });
});
