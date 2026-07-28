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
  TransactionStatusResponse,
  TransactionDetailsResponse,
  TransactionComparison,
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

// ---------------------------------------------------------------------------
// TransactionStatusResponse — corrected shape — Story 09-02
//
// `status`/`objectReference` are MVola's verified field names; the legacy
// `transactionStatus`/`transactionReference` pair is kept but optional.
// ---------------------------------------------------------------------------

describe("TransactionStatusResponse (corrected shape)", () => {
  it("accepts the verified MVola shape without the legacy fields", () => {
    const response: TransactionStatusResponse = {
      status: "completed",
      objectReference: "MVL-REF-1",
      serverCorrelationId: "corr-1",
    };
    expect(response.status).toBe("completed");
    expect(response.objectReference).toBe("MVL-REF-1");
    expect(response.transactionStatus).toBeUndefined();
    expect(response.transactionReference).toBeUndefined();
  });

  it("still accepts the legacy fields alongside the verified ones", () => {
    const response: TransactionStatusResponse = {
      status: "pending",
      objectReference: "MVL-REF-2",
      serverCorrelationId: "corr-2",
      transactionStatus: "pending",
      transactionReference: "MVL-REF-2",
    };
    expect(response.transactionStatus).toBe("pending");
    expect(response.transactionReference).toBe("MVL-REF-2");
  });
});

// ---------------------------------------------------------------------------
// CallbackPayload — relaxed shape — Story 09-02
//
// The callback's real field spelling is unverified, so every status/reference
// field is optional; only the transaction metadata stays required.
// ---------------------------------------------------------------------------

describe("CallbackPayload (relaxed shape)", () => {
  it("accepts the legacy transactionStatus/transactionReference spelling alone", () => {
    const payload: CallbackPayload = {
      transactionStatus: "completed",
      transactionReference: "MVL-REF-3",
      serverCorrelationId: "corr-3",
      amount: "5000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000000" }],
      creditParty: [{ key: "msisdn", value: "0340000001" }],
    };
    expect(payload.transactionStatus).toBe("completed");
    expect(payload.status).toBeUndefined();
  });

  it("accepts the status/objectReference spelling alone", () => {
    const payload: CallbackPayload = {
      status: "failed",
      objectReference: "MVL-REF-4",
      serverCorrelationId: "corr-4",
      amount: "5000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000000" }],
      creditParty: [{ key: "msisdn", value: "0340000001" }],
    };
    expect(payload.status).toBe("failed");
    expect(payload.transactionStatus).toBeUndefined();
  });

  it("accepts a payload with neither status pair present", () => {
    const payload: CallbackPayload = {
      serverCorrelationId: "corr-5",
      amount: "5000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000000" }],
      creditParty: [{ key: "msisdn", value: "0340000001" }],
    };
    expect(payload.status).toBeUndefined();
    expect(payload.transactionStatus).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// TransactionDetailsResponse / TransactionComparison — added — Story 09-02
// ---------------------------------------------------------------------------

describe("TransactionDetailsResponse interface", () => {
  it("accepts the documented fields", () => {
    const details: TransactionDetailsResponse = {
      amount: "5000",
      currency: "Ar",
      transactionReference: "MVL-REF-5",
      transactionStatus: "completed",
      createDate: "2026-07-28T10:00:00.000Z",
      debitParty: [{ key: "msisdn", value: "0340000000" }],
      creditParty: [{ key: "msisdn", value: "0340000001" }],
    };
    expect(details.transactionReference).toBe("MVL-REF-5");
  });

  it("accepts an empty object (every named field is optional)", () => {
    const details: TransactionDetailsResponse = {};
    expect(details.amount).toBeUndefined();
  });

  it("preserves unnamed keys via the index signature", () => {
    const details: TransactionDetailsResponse = { debitPartyId: "unforeseen-key" };
    expect(details.debitPartyId).toBe("unforeseen-key");
  });
});

describe("TransactionComparison interface", () => {
  it("pairs the MVola record with the local record, no verdict field", () => {
    const comparison: TransactionComparison = {
      mvola: { transactionReference: "MVL-REF-6", transactionStatus: "completed" },
      local: {
        localTxId: "tx-010",
        correlationId: "corr-010",
        msisdn: "0340000000",
        direction: "withdraw",
        amount: 5000,
        status: "completed",
        walletSettled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    };
    expect(comparison.mvola.transactionReference).toBe("MVL-REF-6");
    expect(comparison.local.status).toBe("completed");
    expect(comparison).not.toHaveProperty("matches");
  });
});
