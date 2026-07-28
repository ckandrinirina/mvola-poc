/**
 * Tests for GET /api/mvola/status/[correlationId]
 *
 * The status route proxies MVola's transaction status response to the client
 * AND drives local wallet reconciliation via `reconcileTransaction`. Both
 * MVola field spellings (`status`/`objectReference` and
 * `transactionStatus`/`transactionReference`) are read through
 * `parseMvolaStatus()` so the two entry points can never disagree about a
 * transaction's state — see story 09-02 and 09-03.
 *
 * Since story 09-03, the route no longer short-circuits on `MVOLA_ENV`: a
 * `pending` local record always reaches MVola, in every environment. The
 * only remaining skip is a genuinely terminal local record — a settled
 * transaction will not change, so re-asking MVola would be wasted work.
 *
 *   - The MVola status body is always forwarded (200 on success, 502 on
 *     MVola error), even when the local record is missing.
 *   - Wallet and transaction-store side effects only happen on the FIRST
 *     terminal transition for a known correlationId.
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/mvola/status/[correlationId]/route";

import {
  createTransaction,
  getTransactionByCorrelationId,
  updateTransactionStatus,
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
import type { TransactionStatusResponse } from "@/lib/mvola/types";

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
  it("returns 200 with the MVola body, both status spellings, and both reference spellings", async () => {
    mockGetTransactionStatus.mockResolvedValue({
      status: "completed",
      objectReference: "ref-abc",
      serverCorrelationId: "corr-123",
    });

    const response = await GET(buildRequest("corr-123"), buildCtx("corr-123"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "completed",
      objectReference: "ref-abc",
      serverCorrelationId: "corr-123",
      transactionStatus: "completed",
      transactionReference: "ref-abc",
    });
  });

  it("reaches MVola for a pending local record regardless of MVOLA_ENV (no sandbox short-circuit)", async () => {
    const originalEnv = process.env.MVOLA_ENV;
    process.env.MVOLA_ENV = "sandbox";
    try {
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: 5000,
        correlationId: "corr-pending-1",
        walletSettled: false,
      });

      mockGetTransactionStatus.mockResolvedValue({
        status: "pending",
        objectReference: "",
        serverCorrelationId: "corr-pending-1",
      });

      const response = await GET(
        buildRequest("corr-pending-1"),
        buildCtx("corr-pending-1")
      );

      expect(response.status).toBe(200);
      expect(mockGetTransactionStatus).toHaveBeenCalledWith(
        "corr-pending-1",
        "mock-token"
      );
      expect(getWallet("0340000001")?.balance ?? 0).toBe(0);
      expect(
        getTransactionByCorrelationId("corr-pending-1")!.status
      ).toBe("pending");
    } finally {
      process.env.MVOLA_ENV = originalEnv;
    }
  });

  it("skips MVola and returns local truth for an already-terminal local record", async () => {
    const record = createTransaction({
      msisdn: "0340000050",
      direction: "deposit",
      amount: 1000,
      correlationId: "corr-terminal",
      walletSettled: true,
    });
    updateTransactionStatus(record.localTxId, "completed", {
      mvolaReference: "mvola-ref-terminal",
    });

    const response = await GET(
      buildRequest("corr-terminal"),
      buildCtx("corr-terminal")
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      transactionStatus: "completed",
      status: "completed",
      serverCorrelationId: "corr-terminal",
      transactionReference: "mvola-ref-terminal",
      objectReference: "mvola-ref-terminal",
    });
    expect(mockGetTransactionStatus).not.toHaveBeenCalled();
    expect(mockGetToken).not.toHaveBeenCalled();
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
      status: "completed",
      objectReference: "ref-unknown",
      serverCorrelationId: "corr-unknown",
    });

    const response = await GET(buildRequest("corr-unknown"), buildCtx("corr-unknown"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      status: "completed",
      objectReference: "ref-unknown",
      serverCorrelationId: "corr-unknown",
      transactionStatus: "completed",
      transactionReference: "ref-unknown",
    });
  });
});

// --- Wallet reconciliation side-effects --------------------------------

describe("GET /api/mvola/status/[correlationId] — deposit reconciliation", () => {
  it("credits the wallet on the first completed poll for a deposit (status-spelled reply)", async () => {
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
      status: "completed",
      objectReference: "mvola-ref-dep",
      serverCorrelationId: "corr-dep-poll",
    });

    const response = await GET(buildRequest("corr-dep-poll"), buildCtx("corr-dep-poll"));

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)?.balance).toBe(amount);

    const record = getTransactionByCorrelationId("corr-dep-poll")!;
    expect(record.status).toBe("completed");
    expect(record.walletSettled).toBe(true);
    expect(record.mvolaReference).toBe("mvola-ref-dep");
  });

  it("credits the wallet identically for a transactionStatus-spelled reply", async () => {
    const msisdn = "0340000102";
    const amount = 4000;
    createTransaction({
      msisdn,
      direction: "deposit",
      amount,
      correlationId: "corr-dep-poll-legacy",
      walletSettled: false,
    });

    // `status`/`objectReference` are typed as mandatory on the verified
    // response shape, but parseMvolaStatus() must still cope with a reply
    // that omits them and carries only the legacy `transactionStatus`/
    // `transactionReference` pair — the cast below simulates that
    // unverified-but-tolerated real-world shape without weakening the
    // mock's declared type for every other test in this file.
    mockGetTransactionStatus.mockResolvedValue({
      transactionStatus: "completed",
      transactionReference: "mvola-ref-dep-legacy",
      serverCorrelationId: "corr-dep-poll-legacy",
    } as unknown as TransactionStatusResponse);

    const response = await GET(
      buildRequest("corr-dep-poll-legacy"),
      buildCtx("corr-dep-poll-legacy")
    );

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)?.balance).toBe(amount);

    const record = getTransactionByCorrelationId("corr-dep-poll-legacy")!;
    expect(record.status).toBe("completed");
    expect(record.walletSettled).toBe(true);
    expect(record.mvolaReference).toBe("mvola-ref-dep-legacy");
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
      status: "completed",
      objectReference: "mvola-ref-dep2",
      serverCorrelationId: "corr-dep-double",
    });

    await GET(buildRequest("corr-dep-double"), buildCtx("corr-dep-double"));
    await GET(buildRequest("corr-dep-double"), buildCtx("corr-dep-double"));

    expect(getWallet(msisdn)?.balance).toBe(amount);
    // Second poll hits the terminal short-circuit, not MVola again.
    expect(mockGetTransactionStatus).toHaveBeenCalledTimes(1);
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
      status: "failed",
      objectReference: "mvola-ref-wit-fail",
      serverCorrelationId: "corr-wit-fail",
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
      status: "completed",
      objectReference: "mvola-ref-wit-ok",
      serverCorrelationId: "corr-wit-ok",
    });

    const response = await GET(buildRequest("corr-wit-ok"), buildCtx("corr-wit-ok"));

    expect(response.status).toBe(200);
    expect(getWallet(msisdn)!.balance).toBe(seed);

    const record = getTransactionByCorrelationId("corr-wit-ok")!;
    expect(record.status).toBe("completed");
    expect(record.walletSettled).toBe(true);
  });
});
