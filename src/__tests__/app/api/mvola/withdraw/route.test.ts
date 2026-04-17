/**
 * Tests for POST /api/mvola/withdraw route
 *
 * Primary payout initiation endpoint. Validates the request body,
 * acquires an OAuth token, calls initiateWithdrawal(), and returns
 * the correlationId for the client to poll.
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/mvola/withdraw/route";

// Mock auth and client modules so we don't make real HTTP calls
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");

import { getToken } from "@/lib/mvola/auth";
import { initiateWithdrawal } from "@/lib/mvola/client";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockInitiateWithdrawal = initiateWithdrawal as jest.MockedFunction<
  typeof initiateWithdrawal
>;

/**
 * Creates a NextRequest with a JSON body for testing.
 */
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/withdraw", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/mvola/withdraw", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("request validation", () => {
    it("returns 400 when amount is missing", async () => {
      const req = makeRequest({ playerMsisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount and playerMsisdn are required" });
    });

    it("returns 400 when playerMsisdn is missing", async () => {
      const req = makeRequest({ amount: "1000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount and playerMsisdn are required" });
    });

    it("returns 400 when both amount and playerMsisdn are missing", async () => {
      const req = makeRequest({});

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount and playerMsisdn are required" });
    });

    it("returns 400 when body is empty", async () => {
      const req = makeRequest(null);

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json).toEqual({ error: "amount and playerMsisdn are required" });
    });
  });

  describe("happy path", () => {
    it("returns 200 with correlationId and status: pending on success", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "550e8400-e29b-41d4-a716-446655440000",
      });

      const req = makeRequest({ amount: "1000", playerMsisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        correlationId: "550e8400-e29b-41d4-a716-446655440000",
        status: "pending",
      });
    });

    it("calls getToken() then initiateWithdrawal() in order", async () => {
      const callOrder: string[] = [];
      mockGetToken.mockImplementation(async () => {
        callOrder.push("getToken");
        return "mock-token";
      });
      mockInitiateWithdrawal.mockImplementation(async () => {
        callOrder.push("initiateWithdrawal");
        return { status: "pending", serverCorrelationId: "corr-123" };
      });

      const req = makeRequest({ amount: "500", playerMsisdn: "0341111111" });
      await POST(req);

      expect(callOrder).toEqual(["getToken", "initiateWithdrawal"]);
    });

    it("passes amount as a string to initiateWithdrawal", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-456",
      });

      const req = makeRequest({ amount: "2000", playerMsisdn: "0342222222" });
      await POST(req);

      const params = mockInitiateWithdrawal.mock.calls[0][0];
      expect(typeof params.amount).toBe("string");
      expect(params.amount).toBe("2000");
    });

    it("uses default description 'Game withdrawal' when description is not provided", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-789",
      });

      const req = makeRequest({ amount: "3000", playerMsisdn: "0343333333" });
      await POST(req);

      const params = mockInitiateWithdrawal.mock.calls[0][0];
      expect(params.descriptionText).toBe("Game withdrawal");
    });

    it("uses the provided description when given", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-abc",
      });

      const req = makeRequest({
        amount: "1500",
        playerMsisdn: "0344444444",
        description: "Custom description",
      });
      await POST(req);

      const params = mockInitiateWithdrawal.mock.calls[0][0];
      expect(params.descriptionText).toBe("Custom description");
    });

    it("passes the correct playerMsisdn to initiateWithdrawal", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-def",
      });

      const req = makeRequest({ amount: "500", playerMsisdn: "0345555555" });
      await POST(req);

      const params = mockInitiateWithdrawal.mock.calls[0][0];
      expect(params.playerMsisdn).toBe("0345555555");
    });

    it("does not call MVola APIs directly — only getToken and initiateWithdrawal", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockResolvedValue({
        status: "pending",
        serverCorrelationId: "corr-ghi",
      });

      const req = makeRequest({ amount: "750", playerMsisdn: "0346666666" });
      await POST(req);

      expect(mockGetToken).toHaveBeenCalledTimes(1);
      expect(mockInitiateWithdrawal).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("returns 502 with MVola API error details when initiateWithdrawal throws", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockRejectedValue(
        new Error("MVola merchant pay endpoint returned 500: Internal Server Error")
      );

      const req = makeRequest({ amount: "1000", playerMsisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(typeof json.details).toBe("string");
      expect(json.details).toContain("500");
    });

    it("returns 502 when getToken throws", async () => {
      mockGetToken.mockRejectedValue(
        new Error("MVola token endpoint returned 401: Unauthorized")
      );

      const req = makeRequest({ amount: "1000", playerMsisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
      expect(typeof json.details).toBe("string");
    });

    it("returns 502 even for non-Error thrown values", async () => {
      mockGetToken.mockResolvedValue("mock-token");
      mockInitiateWithdrawal.mockRejectedValue("unexpected string error");

      const req = makeRequest({ amount: "1000", playerMsisdn: "0340000000" });

      const response = await POST(req);
      const json = await response.json();

      expect(response.status).toBe(502);
      expect(json.error).toBe("MVola API error");
    });
  });
});
