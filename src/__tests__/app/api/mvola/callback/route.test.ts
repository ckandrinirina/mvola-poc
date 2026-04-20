/**
 * Tests for PUT /api/mvola/callback route
 *
 * MVola sends an asynchronous PUT notification when a transaction completes.
 * This endpoint must always respond 200 OK to prevent MVola from retrying.
 *
 * Updated for story 06-05: logging is now conditional and no secrets / personal
 * data are logged. The route calls reconcileTransaction() when a record is
 * found; duplicate deliveries are idempotent via the walletSettled guard.
 */

import { PUT } from "@/app/api/mvola/callback/route";
import { NextRequest } from "next/server";
import type { CallbackPayload } from "@/lib/mvola/types";

// Mock the store and reconcile helper so we don't touch real in-memory state
jest.mock("@/lib/store/transactions");
jest.mock("@/lib/mvola/reconcile");

import { getTransactionByCorrelationId } from "@/lib/store/transactions";
import { reconcileTransaction } from "@/lib/mvola/reconcile";

const mockGetByCorrelationId =
  getTransactionByCorrelationId as jest.MockedFunction<
    typeof getTransactionByCorrelationId
  >;
const mockReconcile = reconcileTransaction as jest.MockedFunction<
  typeof reconcileTransaction
>;

// Helper: build a minimal NextRequest with a JSON body
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/callback", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/mvola/callback", () => {
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns 200 OK with { received: true } for a valid CallbackPayload (known record)", async () => {
    const payload: CallbackPayload = {
      transactionStatus: "completed",
      serverCorrelationId: "corr-abc-123",
      transactionReference: "ref-xyz-456",
      amount: "5000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000001" }],
      creditParty: [{ key: "msisdn", value: "0340000002" }],
    };
    mockGetByCorrelationId.mockReturnValue({
      localTxId: "local-001",
      correlationId: "corr-abc-123",
      msisdn: "0340000001",
      direction: "deposit",
      amount: 5000,
      status: "pending",
      walletSettled: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    mockReconcile.mockImplementation(() => undefined);

    const response = await PUT(makeRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
  });

  it("does NOT log the full payload to avoid leaking personal data", async () => {
    const payload: CallbackPayload = {
      transactionStatus: "pending",
      serverCorrelationId: "corr-log-test",
      transactionReference: "ref-log-test",
      amount: "1000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000003" }],
      creditParty: [{ key: "msisdn", value: "0340000004" }],
    };
    // Unknown record so we exercise the warning path
    mockGetByCorrelationId.mockReturnValue(undefined);

    const logSpy = jest
      .spyOn(console, "log")
      .mockImplementation(() => undefined);

    await PUT(makeRequest(payload));

    // The old behavior (logging the full JSON payload) must no longer happen
    expect(logSpy).not.toHaveBeenCalledWith(
      "[MVola Callback]",
      JSON.stringify(payload, null, 2)
    );

    logSpy.mockRestore();
  });

  it("returns 200 OK even when the payload has an unexpected structure", async () => {
    const unexpectedPayload = { foo: "bar", baz: 42 };

    const response = await PUT(makeRequest(unexpectedPayload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
  });

  it("returns 200 OK for an empty object payload", async () => {
    const response = await PUT(makeRequest({}));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
  });

  it("logs a warning (not the full payload) without throwing for any payload structure", async () => {
    const strangePayload = { nested: { deep: [1, 2, 3] }, flag: true };

    await expect(PUT(makeRequest(strangePayload))).resolves.toBeDefined();
    // A warning should have been emitted (missing correlationId path)
    expect(warnSpy).toHaveBeenCalled();
  });
});
