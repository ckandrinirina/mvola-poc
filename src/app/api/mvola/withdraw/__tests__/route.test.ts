/**
 * Tests for POST /api/mvola/withdraw route — wallet-aware cash-out.
 *
 * The route submits a REAL payout to MVola in every environment. There is no
 * sandbox short-circuit and no local auto-complete timer (project rules R1/R2),
 * so the behavioural suite below runs identically with `MVOLA_ENV` unset,
 * `"sandbox"`, and `"production"`.
 *
 * Validates that the route:
 * - Rejects invalid request bodies with 400 (missing msisdn/amount, bad amount)
 * - Returns 409 with balance/requested when the wallet has insufficient funds,
 *   without calling MVola
 * - Reserves funds via debitWallet BEFORE acquiring the token or calling MVola
 * - Always acquires an OAuth token and calls initiateWithdrawal()
 * - Records MVola's own serverCorrelationId as the transaction correlationId
 * - On a getToken()/initiateWithdrawal() throw, refunds the wallet exactly once
 *   via creditWallet and returns 502 without creating a transaction record
 * - On success, persists a TransactionRecord with walletSettled=true
 * - Returns 200 { correlationId, localTxId, status: "pending" } on success
 * - Arms no timer and never reconciles a transaction locally
 * - Accepts playerMsisdn as a legacy alias for msisdn
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mvola/withdraw/route";

// Mock auth, client, the transactions store, and reconcile so the route's
// external collaborators are fully observable from tests. The wallet store is
// deliberately NOT mocked — reserve/refund arithmetic is asserted for real.
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");
jest.mock("@/lib/store/transactions");
jest.mock("@/lib/mvola/reconcile");

import { getToken } from "@/lib/mvola/auth";
import { initiateWithdrawal } from "@/lib/mvola/client";
import { createTransaction } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";
import {
  creditWallet,
  getWallet,
  resetAll as resetWallets,
} from "@/lib/store/wallets";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockInitiateWithdrawal = initiateWithdrawal as jest.MockedFunction<
  typeof initiateWithdrawal
>;
const mockCreateTransaction = createTransaction as jest.MockedFunction<
  typeof createTransaction
>;
const mockReconcileTransaction = reconcileTransaction as jest.MockedFunction<
  typeof reconcileTransaction
>;

/** MVola's own correlation ID — the only value the route may record. */
const MVOLA_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";

/** Creates a NextRequest with a JSON body for testing. */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Seeds a wallet with the given MSISDN + balance. */
function seedWallet(msisdn: string, balance: number): void {
  if (balance > 0) creditWallet(msisdn, balance);
}

/**
 * Arms the default success mocks: MVola accepts the payout and returns its own
 * serverCorrelationId; createTransaction echoes back whatever it was handed so
 * a test can prove which correlation ID reached the store.
 */
function armSuccessPath(serverCorrelationId = MVOLA_CORRELATION_ID): void {
  mockGetToken.mockResolvedValue("mock-token");
  mockInitiateWithdrawal.mockResolvedValue({
    status: "pending",
    serverCorrelationId,
  });
  mockCreateTransaction.mockImplementation((input) => ({
    localTxId: "local-tx-123",
    correlationId: input.correlationId,
    msisdn: input.msisdn,
    direction: input.direction,
    amount: input.amount,
    status: "pending",
    walletSettled: input.walletSettled,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }));
}

const originalEnv = process.env.MVOLA_ENV;

afterAll(() => {
  if (originalEnv === undefined) delete process.env.MVOLA_ENV;
  else process.env.MVOLA_ENV = originalEnv;
});

beforeEach(() => {
  // Default to the sandbox-shaped environment (MVOLA_ENV unset) so any
  // resurrected short-circuit is exercised by the whole suite, not hidden
  // behind a production-only run.
  delete process.env.MVOLA_ENV;
});

afterEach(() => {
  jest.clearAllMocks();
  resetWallets();
});

describe("POST /api/mvola/withdraw", () => {
  describe("request validation", () => {
    it("returns 400 when msisdn is missing", async () => {
      const req = makeRequest({ amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "msisdn and amount are required" });
    });

    it("returns 400 when amount is missing", async () => {
      const req = makeRequest({ msisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "msisdn and amount are required" });
    });

    it("returns 400 when both msisdn and amount are missing", async () => {
      const req = makeRequest({});

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "msisdn and amount are required" });
    });

    it("returns 400 when body is null", async () => {
      const req = makeRequest(null);

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "msisdn and amount are required" });
    });

    it("returns 400 when amount is zero", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: 0 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount must be a positive integer" });
    });

    it("returns 400 when amount is negative", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: -500 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount must be a positive integer" });
    });

    it("returns 400 when amount is a non-numeric string", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: "abc" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount must be a positive integer" });
    });

    it("returns 400 when amount is a float", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: 10.5 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount must be a positive integer" });
    });

    it("does not touch the wallet or MVola on a validation failure", async () => {
      seedWallet("0340000000", 5000);
      armSuccessPath();

      await POST(makeRequest({ msisdn: "0340000000", amount: -1 }));

      expect(getWallet("0340000000")?.balance).toBe(5000);
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockInitiateWithdrawal).not.toHaveBeenCalled();
      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });
  });

  describe("legacy playerMsisdn alias", () => {
    beforeEach(() => armSuccessPath("corr-alias"));

    it("accepts playerMsisdn as a legacy alias for msisdn", async () => {
      seedWallet("0343500003", 5000);

      const req = makeRequest({ playerMsisdn: "0343500003", amount: 1000 });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(getWallet("0343500003")?.balance).toBe(4000);
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ msisdn: "0343500003" }),
      );
    });

    it("prefers msisdn over playerMsisdn when both are provided", async () => {
      seedWallet("0343500003", 5000);

      const req = makeRequest({
        msisdn: "0343500003",
        playerMsisdn: "0349999999",
        amount: 1000,
      });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(getWallet("0343500003")?.balance).toBe(4000);
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ msisdn: "0343500003" }),
      );
      expect(mockInitiateWithdrawal.mock.calls[0][0].playerMsisdn).toBe(
        "0343500003",
      );
    });
  });

  describe("insufficient funds (409)", () => {
    beforeEach(() => armSuccessPath());

    it("returns 409 with balance and requested when wallet balance < amount", async () => {
      seedWallet("0340000000", 1000);

      const req = makeRequest({ msisdn: "0340000000", amount: 5000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json).toEqual({
        error: "Insufficient funds",
        balance: 1000,
        requested: 5000,
      });
    });

    it("returns 409 when the wallet does not exist (treated as zero balance)", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(409);
      expect(json).toEqual({
        error: "Insufficient funds",
        balance: 0,
        requested: 1000,
      });
    });

    it("does NOT call getToken, initiateWithdrawal, or createTransaction on 409", async () => {
      seedWallet("0340000000", 500);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockInitiateWithdrawal).not.toHaveBeenCalled();
      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("leaves wallet balance unchanged after a 409 response", async () => {
      seedWallet("0340000000", 500);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(getWallet("0340000000")?.balance).toBe(500);
    });

    it("rejects an amount one Ariary over the balance (boundary)", async () => {
      seedWallet("0340000000", 1000);

      const response = await POST(
        makeRequest({ msisdn: "0340000000", amount: 1001 }),
      );

      expect(response.status).toBe(409);
      expect(getWallet("0340000000")?.balance).toBe(1000);
      expect(mockInitiateWithdrawal).not.toHaveBeenCalled();
    });
  });

  // The real-payout contract must hold identically in every environment:
  // MVOLA_ENV selects the base URL inside client.ts and nothing else (rule R2).
  describe.each([
    ["unset", undefined],
    ["sandbox", "sandbox"],
    ["production", "production"],
  ])("MVOLA_ENV=%s", (_label, envValue) => {
    beforeEach(() => {
      if (envValue === undefined) delete process.env.MVOLA_ENV;
      else process.env.MVOLA_ENV = envValue;
    });

    describe("happy path — wallet reserve + real MVola payout", () => {
      beforeEach(() => armSuccessPath());

      it("returns 200 with correlationId, localTxId, and status: pending", async () => {
        seedWallet("0340000000", 5000);

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          correlationId: MVOLA_CORRELATION_ID,
          localTxId: "local-tx-123",
          status: "pending",
        });
      });

      it("always calls getToken() then initiateWithdrawal() — no short-circuit", async () => {
        seedWallet("0340000000", 5000);

        const callOrder: string[] = [];
        mockGetToken.mockImplementation(async () => {
          callOrder.push("getToken");
          return "mock-token";
        });
        mockInitiateWithdrawal.mockImplementation(async () => {
          callOrder.push("initiateWithdrawal");
          return { status: "pending", serverCorrelationId: MVOLA_CORRELATION_ID };
        });

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(callOrder).toEqual(["getToken", "initiateWithdrawal"]);
        expect(mockInitiateWithdrawal).toHaveBeenCalledTimes(1);
      });

      it("records MVola's serverCorrelationId, never a locally minted UUID", async () => {
        seedWallet("0340000000", 5000);
        armSuccessPath("mvola-server-correlation-id");

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();

        expect(mockCreateTransaction).toHaveBeenCalledWith(
          expect.objectContaining({ correlationId: "mvola-server-correlation-id" }),
        );
        expect(json.correlationId).toBe("mvola-server-correlation-id");
      });

      it("debits the wallet by the requested amount (reserve at request time)", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(getWallet("0340000000")?.balance).toBe(4000);
      });

      it("debits the wallet BEFORE calling getToken (reserve precedes any await)", async () => {
        seedWallet("0340000000", 5000);

        const observedBalances: Array<number | undefined> = [];
        mockGetToken.mockImplementation(async () => {
          observedBalances.push(getWallet("0340000000")?.balance);
          return "mock-token";
        });

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(observedBalances).toEqual([4000]);
      });

      it("passes msisdn as playerMsisdn and amount as a string to initiateWithdrawal", async () => {
        seedWallet("0342222222", 5000);

        await POST(makeRequest({ msisdn: "0342222222", amount: 2000 }));

        const [params, token] = mockInitiateWithdrawal.mock.calls[0];
        expect(params.playerMsisdn).toBe("0342222222");
        expect(typeof params.amount).toBe("string");
        expect(params.amount).toBe("2000");
        expect(params.currency).toBe("Ar");
        expect(token).toBe("mock-token");
      });

      it("uses default description 'Game withdrawal' when description is not provided", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(mockInitiateWithdrawal.mock.calls[0][0].descriptionText).toBe(
          "Game withdrawal",
        );
      });

      it("forwards the provided description when given", async () => {
        seedWallet("0340000000", 5000);

        await POST(
          makeRequest({
            msisdn: "0340000000",
            amount: 1000,
            description: "Cash out to bank",
          }),
        );

        expect(mockInitiateWithdrawal.mock.calls[0][0].descriptionText).toBe(
          "Cash out to bank",
        );
      });

      it("coerces a string amount to a number before passing to createTransaction", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: "1500" }));

        expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          msisdn: "0340000000",
          direction: "withdraw",
          amount: 1500,
          correlationId: MVOLA_CORRELATION_ID,
          walletSettled: true,
        });
      });

      it("persists a TransactionRecord with direction=withdraw and walletSettled=true", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
        expect(mockCreateTransaction).toHaveBeenCalledWith({
          msisdn: "0340000000",
          direction: "withdraw",
          amount: 1000,
          correlationId: MVOLA_CORRELATION_ID,
          walletSettled: true,
        });
      });

      it("allows cash-out of the full wallet balance (edge case: exact match)", async () => {
        seedWallet("0340000000", 1000);

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );

        expect(response.status).toBe(200);
        expect(getWallet("0340000000")?.balance).toBe(0);
      });

      it("does not refund the reserve on success", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));
        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(getWallet("0340000000")?.balance).toBe(3000);
      });
    });

    describe("MVola sync-error refund (502)", () => {
      beforeEach(() => {
        armSuccessPath();
      });

      it("refunds the wallet and returns 502 when initiateWithdrawal throws", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue(
          new Error(
            "MVola merchant pay endpoint returned 500: Internal Server Error",
          ),
        );

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(typeof json.details).toBe("string");
        expect(json.details).toContain("500");
        // Wallet was debited then refunded — back to the starting balance.
        expect(getWallet("0340000000")?.balance).toBe(5000);
      });

      it("refunds the wallet and returns 502 when getToken throws", async () => {
        seedWallet("0340000000", 5000);
        mockGetToken.mockRejectedValue(
          new Error("MVola token endpoint returned 401: Unauthorized"),
        );

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(getWallet("0340000000")?.balance).toBe(5000);
        expect(mockInitiateWithdrawal).not.toHaveBeenCalled();
      });

      it("does NOT call createTransaction on a MVola sync error", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue(new Error("boom"));

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(mockCreateTransaction).not.toHaveBeenCalled();
      });

      it("returns 502 even for non-Error thrown values and refunds the wallet", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue("unexpected string error");

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(json.details).toBe("unexpected string error");
        expect(getWallet("0340000000")?.balance).toBe(5000);
      });

      it("refunds exactly the reserved amount — never more, never twice", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: "0340000000", amount: 1200 }));

        expect(getWallet("0340000000")?.balance).toBe(5000);
      });

      it("leaves the balance untouched across repeated failed cash-outs", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));
        await POST(makeRequest({ msisdn: "0340000000", amount: 2500 }));
        await POST(makeRequest({ msisdn: "0340000000", amount: 5000 }));

        expect(getWallet("0340000000")?.balance).toBe(5000);
        expect(mockCreateTransaction).not.toHaveBeenCalled();
      });

      it("a refunded reserve is immediately spendable again", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValueOnce(new Error("MVola 4002"));

        const failed = await POST(
          makeRequest({ msisdn: "0340000000", amount: 5000 }),
        );
        expect(failed.status).toBe(502);

        const retried = await POST(
          makeRequest({ msisdn: "0340000000", amount: 5000 }),
        );

        expect(retried.status).toBe(200);
        expect(getWallet("0340000000")?.balance).toBe(0);
      });
    });

    describe("no local settlement (rule R1)", () => {
      beforeEach(() => {
        jest.useFakeTimers();
        armSuccessPath();
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it("arms no timer on a successful cash-out", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));

        expect(jest.getTimerCount()).toBe(0);
      });

      it("never reconciles the transaction locally, however long we wait", async () => {
        seedWallet("0340000000", 5000);

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();

        expect(mockReconcileTransaction).not.toHaveBeenCalled();
      });

      it("leaves the transaction pending — settlement is MVola's to report", async () => {
        seedWallet("0340000000", 5000);

        const response = await POST(
          makeRequest({ msisdn: "0340000000", amount: 1000 }),
        );
        const json = await response.json();
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();

        expect(json.status).toBe("pending");
        expect(mockReconcileTransaction).not.toHaveBeenCalled();
        expect(jest.getTimerCount()).toBe(0);
      });

      it("arms no timer on the refund path either", async () => {
        seedWallet("0340000000", 5000);
        mockInitiateWithdrawal.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: "0340000000", amount: 1000 }));
        jest.advanceTimersByTime(60_000);

        expect(jest.getTimerCount()).toBe(0);
        expect(mockReconcileTransaction).not.toHaveBeenCalled();
      });
    });
  });

  // Source-level guards. The deleted shim was invisible to behavioural tests in
  // production mode, which is exactly how it survived; these assertions fail the
  // moment any part of it is reintroduced.
  describe("no sandbox short-circuit in the route source", () => {
    const source = readFileSync(join(__dirname, "..", "route.ts"), "utf8");

    it("does not reference MVOLA_ENV (rule R2 — client.ts owns it)", () => {
      expect(source).not.toContain("MVOLA_ENV");
    });

    it("does not synthesise an MVL-SANDBOX- reference (rule R1)", () => {
      expect(source).not.toContain("MVL-SANDBOX-");
    });

    it("arms no setTimeout and defines no auto-complete delay", () => {
      expect(source).not.toContain("setTimeout");
      expect(source).not.toContain("SANDBOX_AUTO_COMPLETE_MS");
    });

    it("does not mint a local correlation ID", () => {
      expect(source).not.toContain("randomUUID");
    });

    it("does not import the reconciliation helpers the timer needed", () => {
      expect(source).not.toContain("reconcileTransaction");
      expect(source).not.toContain("getTransactionByCorrelationId");
    });
  });
});
