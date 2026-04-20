/**
 * Tests for GET /api/mvola/status/[correlationId]
 *
 * The status route proxies MVola's transactionStatus response to the client
 * AND — starting with story 06-04 — drives local wallet reconciliation via
 * `reconcileTransaction`. The two behaviours are independent:
 *
 *   - The MVola status body is always forwarded unchanged (200 on success,
 *     502 on MVola error), even when the local record is missing.
 *   - Wallet and transaction-store side effects only happen on the FIRST
 *     terminal transition for a known correlationId.
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/mvola/status/[correlationId]/route";

import {
  createTransaction,
  getTransactionByCorrelationId,
  resetAll as resetTransactions,
} from "@/lib/store/transactions";
import {
  creditWallet,
  getWallet,
  resetAll as resetWallets,
} from "@/lib/store/wallets";

// Mock the auth + client modules so no real HTTP is made.
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

function buildCtx(
  correlationId: string
): { params: Promise<{ correlationId: string }> } {
  return { params: Promise.resolve({ correlationId }) };
}

const originalEnv = process.env.MVOLA_ENV;

beforeAll(() => {
  // These tests exercise the real MVola proxy behaviour; the route's
  // sandbox short-circuit is skipped when MVOLA_ENV === "production".
  process.env.MVOLA_ENV = "production";
});

afterAll(() => {
  process.env.MVOLA_ENV = originalEnv;
});

beforeEach(() => {
  resetTransactions();
  resetWallets();
  mockGetToken.mockResolvedValue("mock-token");
});

afterEach(() => {
  jest.clearAllMocks();
});

// --- MVola passthrough behaviour ---------------------------------------

describe("GET /api/mvola/status/[correlationId] — MVola passthrough", () => {
  it("returns 200 with the MVola body on success", async () => {
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-123",
      transactionReference: "ref-abc",
    });

    const response = await GET(buildRequest("corr-123"), buildCtx("corr-123"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      transactionStatus: "completed",
      serverCorrelationId: "corr-123",
      transactionReference: "ref-abc",
    });
  });

  it("forwards pending status as 200 without touching wallet state", async () => {
    createTransaction({
      msisdn: "0340000001",
      direction: "deposit",
      amount: 5000,
      correlationId: "corr-pending-1",
      walletSettled: false,
    });

    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "pending",
      serverCorrelationId: "corr-pending-1",
      transactionReference: "ref-pending",
    });

    const response = await GET(buildRequest("corr-pending-1"), buildCtx("corr-pending-1"));

    expect(response.status).toBe(200);
    expect(getWallet("0340000001")?.balance ?? 0).toBe(0);
    expect(
      getTransactionByCorrelationId("corr-pending-1")!.status
    ).toBe("pending");
  });

  it("returns 502 with { error } when getTransactionStatus() throws", async () => {
    mockGetTransactionStatus.mockRejectedValue(
      new Error("MVola transaction status endpoint returned 500: boom")
    );

    const response = await GET(buildRequest("corr-err"), buildCtx("corr-err"));
    const json = await response.json();

    expect(response.status).toBe(502);
    expect(json).toHaveProperty("error");
    expect(typeof json.error).toBe("string");
  });

  it("returns 502 with { error } when getToken() throws", async () => {
    mockGetToken.mockRejectedValue(new Error("Token acquisition failed"));

    const response = await GET(buildRequest("corr-tok-err"), buildCtx("corr-tok-err"));

    expect(response.status).toBe(502);
  });

  it("returns the MVola body unchanged when the local record is missing", async () => {
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-unknown",
      transactionReference: "ref-unknown",
    });

    const response = await GET(buildRequest("corr-unknown"), buildCtx("corr-unknown"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      transactionStatus: "completed",
      serverCorrelationId: "corr-unknown",
      transactionReference: "ref-unknown",
    });
  });
});

// --- Wallet reconciliation side-effects --------------------------------

describe("GET /api/mvola/status/[correlationId] — deposit reconciliation", () => {
  it("credits the wallet on the first completed poll for a deposit", async () => {
    const msisdn = "0340000100";
    const amount = 5000;
    createTransaction({
      msisdn,
      direction: "deposit",
      amount,
      correlationId: "corr-dep-poll",
      walletSettled: false,
    });

    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-dep-poll",
      transactionReference: "mvola-ref-dep",
    });

    const response = await GET(buildRequest("corr-dep-poll"), buildCtx("corr-dep-poll"));

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)?.balance).toBe(amount);

    const record = getTransactionByCorrelationId("corr-dep-poll")!;
    expect(record.status).toBe("completed");
    expect(record.walletSettled).toBe(true);
    expect(record.mvolaReference).toBe("mvola-ref-dep");
  });

  it("does not double-credit when the same completed status is polled twice", async () => {
    const msisdn = "0340000101";
    const amount = 2500;
    createTransaction({
      msisdn,
      direction: "deposit",
      amount,
      correlationId: "corr-dep-double",
      walletSettled: false,
    });

    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-dep-double",
      transactionReference: "mvola-ref-dep2",
    });

    await GET(buildRequest("corr-dep-double"), buildCtx("corr-dep-double"));
    await GET(buildRequest("corr-dep-double"), buildCtx("corr-dep-double"));

    expect(getWallet(msisdn)?.balance).toBe(amount);
  });
});

describe("GET /api/mvola/status/[correlationId] — withdraw reconciliation", () => {
  it("refunds the wallet on the first failed poll for a withdraw", async () => {
    const msisdn = "0340000200";
    const amount = 3000;
    const seed = 10000 - amount;
    creditWallet(msisdn, seed); // post-debit state
    createTransaction({
      msisdn,
      direction: "withdraw",
      amount,
      correlationId: "corr-wit-fail",
      walletSettled: true,
    });

    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "failed",
      serverCorrelationId: "corr-wit-fail",
      transactionReference: "mvola-ref-wit-fail",
    });

    const response = await GET(buildRequest("corr-wit-fail"), buildCtx("corr-wit-fail"));

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)!.balance).toBe(seed + amount);

    const record = getTransactionByCorrelationId("corr-wit-fail")!;
    expect(record.status).toBe("failed");
    expect(record.walletSettled).toBe(false);
    expect(record.mvolaReference).toBe("mvola-ref-wit-fail");
  });

  it("leaves the wallet untouched on a happy withdraw (stays settled)", async () => {
    const msisdn = "0340000201";
    const amount = 1500;
    const seed = 10000 - amount;
    creditWallet(msisdn, seed);
    createTransaction({
      msisdn,
      direction: "withdraw",
      amount,
      correlationId: "corr-wit-ok",
      walletSettled: true,
    });

    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      serverCorrelationId: "corr-wit-ok",
      transactionReference: "mvola-ref-wit-ok",
    });

    const response = await GET(buildRequest("corr-wit-ok"), buildCtx("corr-wit-ok"));

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)!.balance).toBe(seed);

    const record = getTransactionByCorrelationId("corr-wit-ok")!;
    expect(record.status).toBe("completed");
    expect(record.walletSettled).toBe(true);
  });
});
