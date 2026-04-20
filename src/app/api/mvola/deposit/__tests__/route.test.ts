/**
 * Tests for POST /api/mvola/deposit route
 *
 * Validates that the route:
 * - Rejects invalid request bodies with 400
 * - Calls getToken() then initiateDeposit() in order
 * - Records a pending TransactionRecord after MVola succeeds
 * - Returns 200 with correlationId, localTxId, and status: "pending"
 * - Returns 502 on MVola error without creating any transaction record
 * - Never mutates the wallet balance for the MSISDN
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mvola/deposit/route";

// Mock auth and client modules so we don't make real HTTP calls
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");
jest.mock("@/lib/store/transactions");

import { getToken } from "@/lib/mvola/auth";
import { initiateDeposit } from "@/lib/mvola/client";
import { createTransaction } from "@/lib/store/transactions";
import { getWallet } from "@/lib/store/wallets";
import { resetAll as resetWallets } from "@/lib/store/wallets";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockInitiateDeposit = initiateDeposit as jest.MockedFunction<
  typeof initiateDeposit
>;
const mockCreateTransaction = createTransaction as jest.MockedFunction<
  typeof createTransaction
>;

/**
 * Creates a NextRequest with a JSON body for testing.
 */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/deposit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mvola/deposit", () => {
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

    it("returns 400 when body is empty/null", async () => {
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

  describe("happy path", () => {
    beforeEach(() => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateDeposit.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "550e8400-e29b-41d4-a716-446655440000",
      });
      mockCreateTransaction.mockReturnValue({
        localTxId: "local-tx-123",
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        msisdn: "0340000000",
        direction: "deposit",
        amount: 1000,
        status: "pending",
        walletSettled: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    it("returns 200 with correlationId, localTxId, and status: pending on success", async () => {
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

    it("calls getToken() then initiateDeposit() in order", async () => {
      const callOrder: string[] = [];
      mockGetToken.mockImplementation(async () => {
        callOrder.push("getToken");
        return "mock-token";
      });
      mockInitiateDeposit.mockImplementation(async () => {
        callOrder.push("initiateDeposit");
        return {
          status: "pending",
          serverCorrelationId: "corr-123",
        };
      });

      const req = makeRequest({ msisdn: "0341111111", amount: 500 });
      await POST(req);

      expect(callOrder).toEqual(["getToken", "initiateDeposit"]);
    });

    it("passes msisdn and integer amount to initiateDeposit", async () => {
      const req = makeRequest({ msisdn: "0342222222", amount: "2000" });
      await POST(req);

      const [params, token] = mockInitiateDeposit.mock.calls[0];
      expect(params.msisdn).toBe("0342222222");
      expect(params.amount).toBe(2000);
      expect(token).toBe("mock-token");
    });

    it("coerces string amount to integer before passing to initiateDeposit", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: "500" });
      await POST(req);

      const [params] = mockInitiateDeposit.mock.calls[0];
      expect(typeof params.amount).toBe("number");
      expect(params.amount).toBe(500);
    });

    it("calls createTransaction with correct input after MVola responds", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(mockCreateTransaction).toHaveBeenCalledTimes(1);
      expect(mockCreateTransaction).toHaveBeenCalledWith({
        msisdn: "0340000000",
        direction: "deposit",
        amount: 1000,
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        walletSettled: false,
      });
    });

    it("wallet balance remains unchanged after a successful deposit initiation", async () => {
      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      // Wallet should not have been credited — it stays undefined (no wallet created)
      const wallet = getWallet("0340000000");
      expect(wallet?.balance ?? 0).toBe(0);
    });
  });

  describe("MVola error handling", () => {
    it("returns 502 with MVola API error details when initiateDeposit throws", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateDeposit.mockRejectedValue(
        new Error(
          "MVola deposit merchant pay endpoint returned 500: Internal Server Error"
        )
      );

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(typeof json.details).toBe("string");
      expect(json.details).toContain("500");
    });

    it("does not call createTransaction when initiateDeposit throws", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateDeposit.mockRejectedValue(new Error("MVola failure"));

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });
      await POST(req);

      expect(mockCreateTransaction).not.toHaveBeenCalled();
    });

    it("returns 502 when getToken throws", async () => {
      mockGetToken.mockRejectedValue(
        new Error("MVola token endpoint returned 401: Unauthorized")
      );

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
    });

    it("returns 502 even for non-Error thrown values", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateDeposit.mockRejectedValue("unexpected string error");

      const req = makeRequest({ msisdn: "0340000000", amount: 1000 });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
    });
  });
});
