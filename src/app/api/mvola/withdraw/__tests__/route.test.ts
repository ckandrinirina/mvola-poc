/**
 * Tests for POST /api/mvola/withdraw route — wallet-aware cash-out.
 *
 * Validates that the route:
 * - Rejects invalid request bodies with 400 (missing msisdn/amount, bad amount)
 * - Returns 409 with balance/requested when the wallet has insufficient funds
 * - Reserves funds via debitWallet BEFORE acquiring the token or calling MVola
 * - Acquires an OAuth token and calls initiateWithdrawal()
 * - On sync MVola error, refunds the wallet via creditWallet and returns 502
 *   without creating a transaction record
 * - On success, persists a TransactionRecord with walletSettled=true
 * - Returns 200 { correlationId, localTxId, status: "pending" } on success
 * - Accepts playerMsisdn as a legacy alias for msisdn
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mvola/withdraw/route";

// Mock auth, client, and transactions store so the route's
// external collaborators are fully observable from tests.
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");
jest.mock("@/lib/store/transactions");

import { getToken } from "@/lib/mvola/auth";
import { initiateWithdrawal } from "@/lib/mvola/client";
import { createTransaction } from "@/lib/store/transactions";
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

describe("POST /api/mvola/withdraw", () => {
  afterEach(() => {
    jest.clearAllMocks();
    resetWallets();
  });

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
  });

  describe("legacy playerMsisdn alias", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-alias",
      });
      mockCreateTransaction.mockImplementation((input) => ({
        localTxId: "local-alias",
        correlationId: input.correlationId,
        msisdn: input.msisdn,
        direction: "withdraw",
        amount: input.amount,
        status: "pending",
        walletSettled: input.walletSettled,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }));
    });

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
    });
  });

  describe("insufficient funds (409)", () => {
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
  });

  describe("happy path — wallet reserve + MVola success", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      mockCreateTransaction.mockReturnValue({
        localTxId: "local-tx-123",
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        msisdn: "0340000000",
        direction: "withdraw",
        amount: 1000,
        status: "pending",
        walletSettled: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it("returns 200 with correlationId, localTxId, and status: pending", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        localTxId: "local-tx-123",
        status: "pending",
      });
    });

    it("debits the wallet by the requested amount (reserve at request time)", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(getWallet("0340000000")?.balance).toBe(4000);
    });

    it("debits the wallet BEFORE calling getToken (reserve precedes token fetch)", async () => {
      seedWallet("0340000000", 5000);

      const observedBalances: Array<number | undefined> = [];
      mockGetToken.mockImplementation(async () => {
        observedBalances.push(getWallet("0340000000")?.balance);
        return "mock-token";
      });

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(observedBalances).toEqual([4000]);
    });

    it("calls getToken() then initiateWithdrawal() in order", async () => {
      seedWallet("0340000000", 5000);

      const callOrder: string[] = [];
      mockGetToken.mockImplementation(async () => {
        callOrder.push("getToken");
        return "mock-token";
      });
      mockInitiateWithdrawal.mockImplementation(async () => {
        callOrder.push("initiateWithdrawal");
        return {
          status: "pending",
          serverCorrelationId: "550e8400-e29b-41d4-a716-446655440000",
        };
      });

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(callOrder).toEqual(["getToken", "initiateWithdrawal"]);
    });

    it("passes msisdn as playerMsisdn and amount as string to initiateWithdrawal", async () => {
      seedWallet("0342222222", 5000);

      const req = makeRequest({ msisdn: "0342222222", amount: 2000 });
      await POST(req);

      const [params, token] = mockInitiateWithdrawal.mock.calls[0];
      expect(params.playerMsisdn).toBe("0342222222");
      expect(typeof params.amount).toBe("string");
      expect(params.amount).toBe("2000");
      expect(token).toBe("mock-token");
    });

    it("uses default description 'Game withdrawal' when description is not provided", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      const [params] = mockInitiateWithdrawal.mock.calls[0];
      expect(params.descriptionText).toBe("Game withdrawal");
    });

    it("forwards the provided description when given", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({
        msisdn: "0340000000",
        amount: 1000,
        description: "Cash out to bank",
      });
      await POST(req);

      const [params] = mockInitiateWithdrawal.mock.calls[0];
      expect(params.descriptionText).toBe("Cash out to bank");
    });

    it("coerces a string amount to a number before passing to createTransaction", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({ msisdn: "0340000000", amount: "1500" });
      await POST(req);

      expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateTransaction).toHaveBeenCalledWith({
        msisdn: "0340000000",
        direction: "withdraw",
        amount: 1500,
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        walletSettled: true,
      });
    });

    it("persists a TransactionRecord with direction=withdraw and walletSettled=true", async () => {
      seedWallet("0340000000", 5000);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateTransaction).toHaveBeenCalledWith({
        msisdn: "0340000000",
        direction: "withdraw",
        amount: 1000,
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        walletSettled: true,
      });
    });

    it("allows cash-out of the full wallet balance (edge case: exact match)", async () => {
      seedWallet("0340000000", 1000);

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);

      expect(response.status).toBe(200);
      expect(getWallet("0340000000")?.balance).toBe(0);
    });
  });

  describe("MVola sync-error refund (502)", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock-token");
    });

    it("refunds the wallet and returns 502 when initiateWithdrawal throws", async () => {
      seedWallet("0340000000", 5000);
      mockInitiateWithdrawal.mockRejectedValue(
        new Error("MVola merchant pay endpoint returned 500: Internal Server Error"),
      );

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(typeof json.details).toBe("string");
      expect(json.details).toContain("500");
      // Wallet was debited then refunded — back to starting balance.
      expect(getWallet("0340000000")?.balance).toBe(5000);
    });

    it("refunds the wallet and returns 502 when getToken throws", async () => {
      seedWallet("0340000000", 5000);
      mockGetToken.mockRejectedValue(
        new Error("MVola token endpoint returned 401: Unauthorized"),
      );

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(getWallet("0340000000")?.balance).toBe(5000);
    });

    it("does NOT call createTransaction on a MVola sync error", async () => {
      seedWallet("0340000000", 5000);
      mockInitiateWithdrawal.mockRejectedValue(new Error("boom"));

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("returns 502 even for non-Error thrown values and refunds the wallet", async () => {
      seedWallet("0340000000", 5000);
      mockInitiateWithdrawal.mockRejectedValue("unexpected string error");

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(typeof json.details).toBe("string");
      expect(getWallet("0340000000")?.balance).toBe(5000);
    });
  });
});
