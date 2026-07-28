/**
 * Tests for POST /api/mvola/deposit route — real payment, no auto-complete timer.
 *
 * The route submits a REAL deposit to MVola in every environment. There is no
 * sandbox short-circuit and no local auto-complete timer (project rules R1/R2),
 * so the behavioural suite below runs identically with `MVOLA_ENV` unset,
 * `"sandbox"`, and `"production"`.
 *
 * Mocking strategy: ONLY the HTTP edge (`auth.ts`, `client.ts`) is mocked. The
 * transaction store, the wallet store and `reconcile.ts` are all REAL, so every
 * money assertion reads the actual wallet balance and the actual stored record.
 * That is deliberate: a resurrected sandbox timer calls the real
 * `reconcileTransaction`, which really calls `creditWallet` — a mocked reconcile
 * would let that phantom credit through invisibly, and a `creditWallet`
 * call-count assertion would pass a double-credit, a missing credit and a
 * wrong-amount credit alike.
 *
 * Validates that the route:
 * - Rejects invalid request bodies with 400 (missing msisdn/amount, bad amount)
 * - Always acquires an OAuth token and calls initiateDeposit() — no short-circuit
 * - Records MVola's own serverCorrelationId as the transaction correlationId
 * - NEVER credits the wallet at request time — a deposit credits only on
 *   confirmed settlement, reported later by the callback or status route
 * - On a getToken()/initiateDeposit() throw, returns 502 leaving no phantom
 *   credit and no orphan transaction record
 * - Arms no timer and never reconciles a transaction locally
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/mvola/deposit/route";

// Mock ONLY the HTTP edge. The stores and reconcile stay real — see the module
// docstring for why the wallet assertions depend on that.
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");

import { getToken } from "@/lib/mvola/auth";
import { initiateDeposit } from "@/lib/mvola/client";
import {
  getTransactionByCorrelationId,
  listTransactionsByMsisdn,
  resetAll as resetTransactions,
} from "@/lib/store/transactions";
import {
  creditWallet,
  getWallet,
  resetAll as resetWallets,
} from "@/lib/store/wallets";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockInitiateDeposit = initiateDeposit as jest.MockedFunction<
  typeof initiateDeposit
>;

/** MVola's own correlation ID — the only value the route may record. */
const MVOLA_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";

/** The MSISDN used across the behavioural suite. */
const MSISDN = "0343500003";

/** Creates a NextRequest with a JSON body for testing. */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/**
 * Arms the default success mocks: MVola accepts the deposit and returns its own
 * serverCorrelationId.
 */
function armSuccessPath(serverCorrelationId = MVOLA_CORRELATION_ID): void {
  mockGetToken.mockResolvedValue("mock-token");
  mockInitiateDeposit.mockResolvedValue({
    status: "pending",
    serverCorrelationId,
  });
}

/**
 * Arms the success path with a fresh correlation ID per call, for tests that
 * deposit more than once (the real store rejects a duplicate correlationId).
 */
function armSuccessPathUnique(): void {
  let n = 0;
  mockGetToken.mockResolvedValue("mock-token");
  mockInitiateDeposit.mockImplementation(async () => ({
    status: "pending",
    serverCorrelationId: `corr-${++n}`,
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
  resetTransactions();
});

describe("POST /api/mvola/deposit", () => {
  describe("request validation", () => {
    it("returns 400 when msisdn is missing", async () => {
      const response = await POST(makeRequest({ amount: 1000 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "msisdn and amount are required",
      });
    });

    it("returns 400 when amount is missing", async () => {
      const response = await POST(makeRequest({ msisdn: MSISDN }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "msisdn and amount are required",
      });
    });

    it("returns 400 when both msisdn and amount are missing", async () => {
      const response = await POST(makeRequest({}));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "msisdn and amount are required",
      });
    });

    it("returns 400 when body is empty/null", async () => {
      const response = await POST(makeRequest(null));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "msisdn and amount are required",
      });
    });

    it("returns 400 when amount is zero", async () => {
      const response = await POST(makeRequest({ msisdn: MSISDN, amount: 0 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "amount must be a positive integer",
      });
    });

    it("returns 400 when amount is negative", async () => {
      const response = await POST(makeRequest({ msisdn: MSISDN, amount: -500 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "amount must be a positive integer",
      });
    });

    it("returns 400 when amount is a non-numeric string", async () => {
      const response = await POST(makeRequest({ msisdn: MSISDN, amount: "abc" }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "amount must be a positive integer",
      });
    });

    it("returns 400 when amount is a float", async () => {
      const response = await POST(makeRequest({ msisdn: MSISDN, amount: 10.5 }));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "amount must be a positive integer",
      });
    });

    it("does not touch the wallet, the store, or MVola on a validation failure", async () => {
      armSuccessPath();

      await POST(makeRequest({ msisdn: MSISDN, amount: -1 }));

      expect(getWallet(MSISDN)?.balance ?? 0).toBe(0);
      expect(listTransactionsByMsisdn(MSISDN)).toEqual([]);
      expect(mockGetToken).not.toHaveBeenCalled();
      expect(mockInitiateDeposit).not.toHaveBeenCalled();
    });
  });

  // The real-payment contract must hold identically in every environment:
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

    describe("happy path — real MVola deposit initiation", () => {
      beforeEach(() => armSuccessPath());

      it("returns 200 with correlationId, localTxId, and status: pending", async () => {
        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.correlationId).toBe(MVOLA_CORRELATION_ID);
        expect(json.status).toBe("pending");
        expect(typeof json.localTxId).toBe("string");
      });

      it("always calls getToken() then initiateDeposit() — no short-circuit", async () => {
        const callOrder: string[] = [];
        mockGetToken.mockImplementation(async () => {
          callOrder.push("getToken");
          return "mock-token";
        });
        mockInitiateDeposit.mockImplementation(async () => {
          callOrder.push("initiateDeposit");
          return { status: "pending", serverCorrelationId: MVOLA_CORRELATION_ID };
        });

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(callOrder).toEqual(["getToken", "initiateDeposit"]);
        expect(mockInitiateDeposit).toHaveBeenCalledTimes(1);
      });

      it("passes msisdn, the integer amount, and the token to initiateDeposit", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 2000 }));

        const [params, token] = mockInitiateDeposit.mock.calls[0];
        expect(params.msisdn).toBe(MSISDN);
        expect(params.amount).toBe(2000);
        expect(typeof params.amount).toBe("number");
        expect(token).toBe("mock-token");
      });

      it("coerces a string amount to an integer before calling initiateDeposit", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: "500" }));

        const [params] = mockInitiateDeposit.mock.calls[0];
        expect(typeof params.amount).toBe("number");
        expect(params.amount).toBe(500);
      });

      it("records MVola's serverCorrelationId, never a locally minted UUID", async () => {
        armSuccessPath("mvola-server-correlation-id");

        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );
        const json = await response.json();

        expect(json.correlationId).toBe("mvola-server-correlation-id");
        const stored = getTransactionByCorrelationId(
          "mvola-server-correlation-id",
        );
        expect(stored).toBeDefined();
        expect(stored?.correlationId).toBe("mvola-server-correlation-id");
      });

      it("persists a pending deposit record with walletSettled=false", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        const stored = getTransactionByCorrelationId(MVOLA_CORRELATION_ID);
        expect(stored).toMatchObject({
          msisdn: MSISDN,
          direction: "deposit",
          amount: 1000,
          status: "pending",
          walletSettled: false,
        });
      });

      it("stores the coerced integer amount, not the raw string", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: "1500" }));

        const stored = getTransactionByCorrelationId(MVOLA_CORRELATION_ID);
        expect(stored?.amount).toBe(1500);
      });

      it("creates exactly one transaction record per request", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(listTransactionsByMsisdn(MSISDN)).toHaveLength(1);
      });
    });

    describe("wallet accounting — credit only on confirmed settlement (rule R3)", () => {
      beforeEach(() => armSuccessPath());

      it("does NOT credit the wallet at request time", async () => {
        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );

        expect(response.status).toBe(200);
        expect(getWallet(MSISDN)?.balance ?? 0).toBe(0);
      });

      it("leaves an existing balance exactly as it was", async () => {
        creditWallet(MSISDN, 5000);

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(getWallet(MSISDN)?.balance).toBe(5000);
      });

      it("credits nothing across repeated deposit requests", async () => {
        armSuccessPathUnique();
        creditWallet(MSISDN, 5000);

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        await POST(makeRequest({ msisdn: MSISDN, amount: 2000 }));
        await POST(makeRequest({ msisdn: MSISDN, amount: 3000 }));

        expect(getWallet(MSISDN)?.balance).toBe(5000);
        expect(listTransactionsByMsisdn(MSISDN)).toHaveLength(3);
      });

      it("leaves the record unsettled — settlement is MVola's to report", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        const stored = getTransactionByCorrelationId(MVOLA_CORRELATION_ID);
        expect(stored?.walletSettled).toBe(false);
        expect(stored?.status).toBe("pending");
        expect(stored?.mvolaReference).toBeUndefined();
      });
    });

    describe("MVola error handling (502) — no phantom credit, no orphan record", () => {
      beforeEach(() => armSuccessPath());

      it("returns 502 with details when initiateDeposit throws", async () => {
        mockInitiateDeposit.mockRejectedValue(
          new Error(
            "MVola deposit merchant pay endpoint returned 500: Internal Server Error",
          ),
        );

        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(typeof json.details).toBe("string");
        expect(json.details).toContain("500");
      });

      it("returns 502 when getToken throws, without calling initiateDeposit", async () => {
        mockGetToken.mockRejectedValue(
          new Error("MVola token endpoint returned 401: Unauthorized"),
        );

        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(mockInitiateDeposit).not.toHaveBeenCalled();
      });

      it("returns 502 even for non-Error thrown values", async () => {
        mockInitiateDeposit.mockRejectedValue("unexpected string error");

        const response = await POST(
          makeRequest({ msisdn: MSISDN, amount: 1000 }),
        );
        const json = await response.json();

        expect(response.status).toBe(502);
        expect(json.error).toBe("MVola API error");
        expect(json.details).toBe("unexpected string error");
      });

      it("leaves NO phantom credit on the wallet when initiateDeposit throws", async () => {
        creditWallet(MSISDN, 5000);
        mockInitiateDeposit.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(getWallet(MSISDN)?.balance).toBe(5000);
      });

      it("leaves NO phantom credit on the wallet when getToken throws", async () => {
        creditWallet(MSISDN, 5000);
        mockGetToken.mockRejectedValue(new Error("MVola 401"));

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(getWallet(MSISDN)?.balance).toBe(5000);
      });

      it("creates NO orphan transaction record on a MVola failure", async () => {
        mockInitiateDeposit.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(listTransactionsByMsisdn(MSISDN)).toEqual([]);
        expect(getTransactionByCorrelationId(MVOLA_CORRELATION_ID)).toBeUndefined();
      });

      it("leaves balance and store untouched across repeated failed deposits", async () => {
        creditWallet(MSISDN, 5000);
        mockInitiateDeposit.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        await POST(makeRequest({ msisdn: MSISDN, amount: 2500 }));
        await POST(makeRequest({ msisdn: MSISDN, amount: 5000 }));

        expect(getWallet(MSISDN)?.balance).toBe(5000);
        expect(listTransactionsByMsisdn(MSISDN)).toEqual([]);
      });

      it("a failed deposit does not block a later successful one", async () => {
        mockInitiateDeposit.mockRejectedValueOnce(new Error("MVola 4002"));
        mockInitiateDeposit.mockResolvedValue({
          status: "pending",
          serverCorrelationId: MVOLA_CORRELATION_ID,
        });

        const failed = await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        expect(failed.status).toBe(502);

        const retried = await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(retried.status).toBe(200);
        expect(listTransactionsByMsisdn(MSISDN)).toHaveLength(1);
        expect(getWallet(MSISDN)?.balance ?? 0).toBe(0);
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

      it("arms no timer on a successful deposit", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));

        expect(jest.getTimerCount()).toBe(0);
      });

      it("arms no timer on the failure path either", async () => {
        mockInitiateDeposit.mockRejectedValue(new Error("MVola 4002"));

        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        jest.advanceTimersByTime(60_000);

        expect(jest.getTimerCount()).toBe(0);
        expect(getWallet(MSISDN)?.balance ?? 0).toBe(0);
        expect(listTransactionsByMsisdn(MSISDN)).toEqual([]);
      });

      it("never completes the transaction locally, however long we wait", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();

        const stored = getTransactionByCorrelationId(MVOLA_CORRELATION_ID);
        expect(stored?.status).toBe("pending");
        expect(stored?.walletSettled).toBe(false);
        expect(jest.getTimerCount()).toBe(0);
      });

      it("never credits the wallet from a local timer (no fabricated settlement)", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();

        // Real reconcile + real wallet store: a resurrected timer would credit
        // 1000 here. The balance is the assertion, not a mock call count.
        expect(getWallet(MSISDN)?.balance ?? 0).toBe(0);
      });

      it("never synthesises an MVola reference for the record", async () => {
        await POST(makeRequest({ msisdn: MSISDN, amount: 1000 }));
        jest.advanceTimersByTime(60_000);
        await Promise.resolve();

        const stored = getTransactionByCorrelationId(MVOLA_CORRELATION_ID);
        expect(stored?.mvolaReference).toBeUndefined();
      });
    });
  });

  // Source-level guards. The sandbox shim was invisible to behavioural tests
  // pinned to production mode, which is exactly how it survived; these
  // assertions fail the moment any part of it is reintroduced.
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

    it("never moves the wallet directly from the route", () => {
      expect(source).not.toContain("creditWallet");
      expect(source).not.toContain("debitWallet");
    });
  });
});
