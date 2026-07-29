/**
 * Tests for GET /api/mvola/transaction/[transactionReference] — transaction
 * details route.
 *
 * Validates that the route:
 * - Returns 200 { mvola, local } when a local record carries the reference
 * - Looks up the local record BEFORE calling MVola or acquiring a token
 * - Returns 404 { error } when no local record carries the reference, and
 *   never calls getToken() or getTransactionDetails() in that case
 * - Returns 502 { error, details } when getToken() or getTransactionDetails()
 *   throws
 * - Forwards the `mvola` object byte-for-byte — never reshapes it
 * - Never includes a verdict/match/diff field in any response
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/mvola/transaction/[transactionReference]/route";

// Mock auth, client, and the transactions store so the route's external
// collaborators are fully observable from tests.
jest.mock("@/lib/mvola/auth");
jest.mock("@/lib/mvola/client");
jest.mock("@/lib/store/transactions");

import { getToken } from "@/lib/mvola/auth";
import { getTransactionDetails } from "@/lib/mvola/client";
import { getTransactionByMvolaReference } from "@/lib/store/transactions";
import type { TransactionRecord, TransactionDetailsResponse } from "@/lib/mvola/types";

const mockGetToken = getToken as jest.MockedFunction<typeof getToken>;
const mockGetTransactionDetails = getTransactionDetails as jest.MockedFunction<
  typeof getTransactionDetails
>;
const mockGetTransactionByMvolaReference =
  getTransactionByMvolaReference as jest.MockedFunction<
    typeof getTransactionByMvolaReference
  >;

const REFERENCE = "MVL-2026-07-28-001";

const LOCAL_RECORD: TransactionRecord = {
  localTxId: "tx_local_001",
  correlationId: "550e8400-e29b-41d4-a716-446655440000",
  msisdn: "0343500003",
  direction: "deposit",
  amount: 5000,
  status: "completed",
  walletSettled: true,
  mvolaReference: REFERENCE,
  createdAt: 1785000000000,
  updatedAt: 1785000042000,
};

const MVOLA_DETAILS: TransactionDetailsResponse = {
  amount: "5000",
  currency: "Ar",
  transactionReference: REFERENCE,
  transactionStatus: "completed",
  createDate: "2026-07-28T10:32:11.000Z",
  debitParty: [{ key: "msisdn", value: "0343500003" }],
  creditParty: [{ key: "msisdn", value: "034XXXXXXX" }],
};

function makeRequest(reference: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/mvola/transaction/${reference}`
  );
}

async function callRoute(reference: string) {
  return GET(makeRequest(reference), {
    params: Promise.resolve({ transactionReference: reference }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/mvola/transaction/[transactionReference]", () => {
  it("returns 200 with both mvola and local records when the reference is known", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockResolvedValue(MVOLA_DETAILS);

    const response = await callRoute(REFERENCE);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      mvola: MVOLA_DETAILS,
      local: LOCAL_RECORD,
    });
  });

  it("looks up the local record via getTransactionByMvolaReference with the path reference", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockResolvedValue(MVOLA_DETAILS);

    await callRoute(REFERENCE);

    expect(mockGetTransactionByMvolaReference).toHaveBeenCalledWith(REFERENCE);
  });

  it("returns 404 with no local record and never calls getToken or getTransactionDetails", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(undefined);

    const response = await callRoute("UNKNOWN-REF");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No local transaction carries that reference",
    });
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(mockGetTransactionDetails).not.toHaveBeenCalled();
  });

  it("returns 502 with details when getTransactionDetails throws", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockRejectedValue(
      new Error("MVola transaction details endpoint returned 404: not found")
    );

    const response = await callRoute(REFERENCE);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "MVola API error",
      details: "MVola transaction details endpoint returned 404: not found",
    });
  });

  it("returns 502 with details when getToken throws", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockRejectedValue(
      new Error("MVola token endpoint returned 401: invalid credentials")
    );

    const response = await callRoute(REFERENCE);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: "MVola API error",
      details: "MVola token endpoint returned 401: invalid credentials",
    });
    expect(mockGetTransactionDetails).not.toHaveBeenCalled();
  });

  it("forwards the mvola object byte-for-byte, including unknown/extra keys", async () => {
    const detailsWithExtraKeys: TransactionDetailsResponse = {
      ...MVOLA_DETAILS,
      someFutureField: "unpredicted-value",
      nested: { a: 1 },
    };
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockResolvedValue(detailsWithExtraKeys);

    const response = await callRoute(REFERENCE);
    const body = await response.json();

    expect(body.mvola).toEqual(detailsWithExtraKeys);
  });

  it("never includes a verdict, match, or diff field in the 200 response", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockResolvedValue(MVOLA_DETAILS);

    const response = await callRoute(REFERENCE);
    const body = await response.json();

    expect(body).not.toHaveProperty("matches");
    expect(body).not.toHaveProperty("verdict");
    expect(body).not.toHaveProperty("diff");
    expect(Object.keys(body).sort()).toEqual(["local", "mvola"]);
  });

  it("never includes a verdict, match, or diff field in the 404 response", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(undefined);

    const response = await callRoute("UNKNOWN-REF");
    const body = await response.json();

    expect(body).not.toHaveProperty("matches");
    expect(body).not.toHaveProperty("verdict");
    expect(body).not.toHaveProperty("diff");
  });

  it("never includes a verdict, match, or diff field in the 502 response", async () => {
    mockGetTransactionByMvolaReference.mockReturnValue(LOCAL_RECORD);
    mockGetToken.mockResolvedValue("tok");
    mockGetTransactionDetails.mockRejectedValue(new Error("boom"));

    const response = await callRoute(REFERENCE);
    const body = await response.json();

    expect(body).not.toHaveProperty("matches");
    expect(body).not.toHaveProperty("verdict");
    expect(body).not.toHaveProperty("diff");
  });
});
