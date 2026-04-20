/**
 * Route tests for POST /api/game/coinflip (Story 07-02)
 *
 * Covers all acceptance criteria:
 * - 400 for each invalid input path
 * - 409 for insufficient funds
 * - 200 win path (mocked RNG via playCoinFlip mock)
 * - 200 loss path (mocked RNG via playCoinFlip mock)
 * - Wallet balance is correct after each scenario
 */

import { NextRequest } from "next/server";
import { POST } from "../route";
import { creditWallet, getWallet, resetAll as resetWallets } from "@/lib/store/wallets";
import { resetAll as resetSessions } from "@/lib/store/games";

// Mock playCoinFlip to force deterministic outcomes
jest.mock("@/lib/game/coinflip");
import { playCoinFlip } from "@/lib/game/coinflip";
const mockPlayCoinFlip = playCoinFlip as jest.MockedFunction<typeof playCoinFlip>;

// Helper: build a NextRequest from a plain object body
function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/game/coinflip", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  resetWallets();
  resetSessions();
  jest.clearAllMocks();
});

// ─── 400 Validation errors ────────────────────────────────────────────────────

describe("400 — validation errors", () => {
  it("returns 400 when msisdn is missing", async () => {
    const req = makeRequest({ bet: 100, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(typeof body.details).toBe("string");
  });

  it("returns 400 when msisdn is empty string", async () => {
    const req = makeRequest({ msisdn: "", bet: 100, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when bet is missing", async () => {
    const req = makeRequest({ msisdn: "0341234567", choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when bet is zero", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 0, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when bet is negative", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: -50, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when bet is a non-integer float", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 1.5, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when bet is a string", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: "100", choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when choice is missing", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100 });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });

  it("returns 400 when choice is invalid ('eagle')", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "eagle" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
  });
});

// ─── 409 Insufficient funds ───────────────────────────────────────────────────

describe("409 — insufficient funds", () => {
  it("returns 409 when wallet balance is less than bet", async () => {
    // Wallet has 50, bet is 100
    creditWallet("0341234567", 50);
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Insufficient funds");
    expect(body.balance).toBe(50);
    expect(body.requested).toBe(100);
  });

  it("returns 409 when wallet does not exist (balance = 0)", async () => {
    const req = makeRequest({ msisdn: "0349999999", bet: 100, choice: "tails" });
    const res = await POST(req);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe("Insufficient funds");
  });

  it("does not modify the wallet balance on 409", async () => {
    creditWallet("0341234567", 50);
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    await POST(req);
    const wallet = getWallet("0341234567");
    expect(wallet?.balance).toBe(50);
  });
});

// ─── 200 Win path ─────────────────────────────────────────────────────────────

describe("200 — win path", () => {
  beforeEach(() => {
    // Force a win: outcome matches choice "heads"
    mockPlayCoinFlip.mockReturnValue({ outcome: "heads", result: "win", delta: 100 });
    creditWallet("0341234567", 500);
  });

  it("returns 200 with correct shape on win", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      sessionId: expect.any(String),
      outcome: "heads",
      result: "win",
      delta: 100,
      balanceAfter: 600, // 500 - 100 (debit) + 200 (credit on win) = 600
    });
  });

  it("wallet balance is +bet after win (net gain)", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    await POST(req);
    const wallet = getWallet("0341234567");
    expect(wallet?.balance).toBe(600); // 500 + 100 net gain
  });

  it("sessionId is a valid UUID", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    const res = await POST(req);
    const body = await res.json();
    expect(body.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

// ─── 200 Loss path ────────────────────────────────────────────────────────────

describe("200 — loss path", () => {
  beforeEach(() => {
    // Force a loss: outcome is tails but player chose heads
    mockPlayCoinFlip.mockReturnValue({ outcome: "tails", result: "loss", delta: -100 });
    creditWallet("0341234567", 500);
  });

  it("returns 200 with correct shape on loss", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      sessionId: expect.any(String),
      outcome: "tails",
      result: "loss",
      delta: -100,
      balanceAfter: 400, // 500 - 100 (debit), no credit on loss
    });
  });

  it("wallet balance is -bet after loss", async () => {
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    await POST(req);
    const wallet = getWallet("0341234567");
    expect(wallet?.balance).toBe(400); // 500 - 100
  });

  it("creditWallet is NOT called on loss", async () => {
    // We verify by checking the balance is exactly 400, not 600
    const req = makeRequest({ msisdn: "0341234567", bet: 100, choice: "heads" });
    await POST(req);
    const wallet = getWallet("0341234567");
    expect(wallet?.balance).toBe(400);
  });
});
