/**
 * Tests for GET /api/wallet/[msisdn]/balance route
 *
 * Read-only endpoint returning the current wallet balance for an MSISDN.
 * Unknown MSISDNs return { balance: 0, updatedAt: null } with status 200.
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/wallet/[msisdn]/balance/route";

// Mock the wallets store to control wallet state in tests
jest.mock("@/lib/store/wallets");

import { getWallet } from "@/lib/store/wallets";

const mockGetWallet = getWallet as jest.MockedFunction<typeof getWallet>;

function buildRequest(msisdn: string): NextRequest {
  return new NextRequest(`http://localhost/api/wallet/${msisdn}/balance`);
}

describe("GET /api/wallet/[msisdn]/balance", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns 200 with msisdn, balance, and updatedAt for a known wallet", async () => {
    const now = Date.now();
    mockGetWallet.mockReturnValue({
      msisdn: "0340000001",
      balance: 5000,
      createdAt: now - 10000,
      updatedAt: now,
    });

    const req = buildRequest("0340000001");
    const response = await GET(req, { params: Promise.resolve({ msisdn: "0340000001" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      msisdn: "0340000001",
      balance: 5000,
      updatedAt: now,
    });
  });

  it("returns 200 with balance=0 and updatedAt=null for an unknown MSISDN", async () => {
    mockGetWallet.mockReturnValue(undefined);

    const req = buildRequest("0340000099");
    const response = await GET(req, { params: Promise.resolve({ msisdn: "0340000099" }) });
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({
      msisdn: "0340000099",
      balance: 0,
      updatedAt: null,
    });
  });

  it("propagates the msisdn from the URL path parameter into the response", async () => {
    mockGetWallet.mockReturnValue(undefined);

    const msisdn = "0330012345";
    const req = buildRequest(msisdn);
    const response = await GET(req, { params: Promise.resolve({ msisdn }) });
    const json = await response.json();

    expect(json.msisdn).toBe(msisdn);
    expect(mockGetWallet).toHaveBeenCalledWith(msisdn);
  });

  it("calls getWallet with the msisdn from context.params", async () => {
    const now = Date.now();
    mockGetWallet.mockReturnValue({
      msisdn: "0340000002",
      balance: 1000,
      createdAt: now,
      updatedAt: now,
    });

    const req = buildRequest("0340000002");
    await GET(req, { params: Promise.resolve({ msisdn: "0340000002" }) });

    expect(mockGetWallet).toHaveBeenCalledTimes(1);
    expect(mockGetWallet).toHaveBeenCalledWith("0340000002");
  });
});
