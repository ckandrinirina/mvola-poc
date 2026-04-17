/**
 * Tests for PUT /api/mvola/callback route
 *
 * MVola sends an asynchronous PUT notification when a transaction completes.
 * This endpoint must always respond 200 OK to prevent MVola from retrying.
 */

import { PUT } from "@/app/api/mvola/callback/route";
import { NextRequest } from "next/server";
import type { CallbackPayload } from "@/lib/mvola/types";

// Helper: build a minimal NextRequest with a JSON body
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/mvola/callback", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PUT /api/mvola/callback", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("returns 200 OK with { received: true } for a valid CallbackPayload", async () => {
    const payload: CallbackPayload = {
      transactionStatus: "completed",
      serverCorrelationId: "corr-abc-123",
      transactionReference: "ref-xyz-456",
      amount: "5000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000001" }],
      creditParty: [{ key: "msisdn", value: "0340000002" }],
    };

    const response = await PUT(makeRequest(payload));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ received: true });
  });

  it("logs the callback payload to console.log", async () => {
    const payload: CallbackPayload = {
      transactionStatus: "pending",
      serverCorrelationId: "corr-log-test",
      transactionReference: "ref-log-test",
      amount: "1000",
      currency: "Ar",
      debitParty: [{ key: "msisdn", value: "0340000003" }],
      creditParty: [{ key: "msisdn", value: "0340000004" }],
    };

    await PUT(makeRequest(payload));

    expect(consoleSpy).toHaveBeenCalledWith(
      "[MVola Callback]",
      JSON.stringify(payload, null, 2)
    );
  });

  it("returns 200 OK even when the payload is unexpected / malformed JSON structure", async () => {
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

  it("logs any payload structure without throwing", async () => {
    const strangePayload = { nested: { deep: [1, 2, 3] }, flag: true };

    await expect(PUT(makeRequest(strangePayload))).resolves.toBeDefined();
    expect(consoleSpy).toHaveBeenCalled();
  });
});
