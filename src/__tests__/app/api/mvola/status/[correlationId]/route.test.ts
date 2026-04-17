/**
 * Tests for GET /api/mvola/status/[correlationId] route
 *
 * Polls the MVola transaction status by correlationId.
 * Covers the happy path and error handling (502 on MVola failure).
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/mvola/status/[correlationId]/route";

// Mock the auth and client modules so we don't make real HTTP calls
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");

import { getToken } from "@/lib/mvola/auth";
import { getTransactionStatus } from "@/lib/mvola/client";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockGetTransactionStatus = getTransactionStatus as jest.MockedFunction<
  typeof getTransactionStatus
>;

function buildRequest(correlationId: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/mvola/status/${correlationId}`
  );
}

describe("GET /api/mvola/status/[correlationId]", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with transactionStatus, serverCorrelationId, and transactionReference on success", async () => {
    mockGetToken.mockResolvedValue("mock-token");
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-123",
      transactionReference: "ref-abc",
    });

    const req = buildRequest("corr-123");
    const response = await GET(req, { params: { correlationId: "corr-123" } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      transactionStatus: "completed",
      serverCorrelationId: "corr-123",
      transactionReference: "ref-abc",
    });
  });

  it("calls getToken() then getTransactionStatus() with the correlationId", async () => {
    mockGetToken.mockResolvedValue("test-token");
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "pending",
      serverCorrelationId: "corr-456",
      transactionReference: "ref-xyz",
    });

    const req = buildRequest("corr-456");
    await GET(req, { params: { correlationId: "corr-456" } });

    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(mockGetTransactionStatus).toHaveBeenCalledWith("corr-456", "test-token");
  });

  it("returns 200 when transactionStatus is pending", async () => {
    mockGetToken.mockResolvedValue("mock-token");
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "pending",
      serverCorrelationId: "corr-789",
      transactionReference: "ref-def",
    });

    const req = buildRequest("corr-789");
    const response = await GET(req, { params: { correlationId: "corr-789" } });

    expect(response.status).toBe(200);
  });

  it("returns 200 when transactionStatus is failed", async () => {
    mockGetToken.mockResolvedValue("mock-token");
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "failed",
      serverCorrelationId: "corr-999",
      transactionReference: "ref-fail",
    });

    const req = buildRequest("corr-999");
    const response = await GET(req, { params: { correlationId: "corr-999" } });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.transactionStatus).toBe("failed");
  });

  it("returns 502 with { error } when getTransactionStatus() throws", async () => {
    mockGetToken.mockResolvedValue("mock-token");
    mockGetTransactionStatus.mockRejectedValue(
      new Error("MVola transaction status endpoint returned 500: Internal Server Error")
    );

    const req = buildRequest("corr-err");
    const response = await GET(req, { params: { correlationId: "corr-err" } });
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });

  it("returns 502 with { error } when getToken() throws", async () => {
    mockGetToken.mockRejectedValue(new Error("Token acquisition failed"));

    const req = buildRequest("corr-tok-err");
    const response = await GET(req, {
      params: { correlationId: "corr-tok-err" },
    });
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });
});
