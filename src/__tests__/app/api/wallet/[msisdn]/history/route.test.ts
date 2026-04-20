/**
 * Tests for GET /api/wallet/[msisdn]/history route
 *
 * Returns a merged, time-sorted array of every TransactionRecord and
 * GameSession for the given MSISDN. Each entry is tagged with kind:
 * "transaction" or kind: "game" so the UI can render them uniformly.
 */

import { NextRequest } from "next/server";
import { GET } from "@/app/api/wallet/[msisdn]/history/route";
import {
  createTransaction,
  resetAll as resetTransactions,
} from "@/lib/store/transactions";
import {
  recordGameSession,
  resetAll as resetGames,
} from "@/lib/store/games";

/**
 * Creates a GET NextRequest for the history route.
 */
function makeRequest(msisdn: string): NextRequest {
  return new NextRequest(
    `http://localhost/api/wallet/${msisdn}/history`,
    { method: "GET" }
  );
}

/**
 * Creates a RouteContext-like object with the msisdn param.
 */
function makeContext(msisdn: string) {
  return {
    params: Promise.resolve({ msisdn }),
  };
}

describe("GET /api/wallet/[msisdn]/history", () => {
  beforeEach(() => {
    resetTransactions();
    resetGames();
  });

  describe("empty case", () => {
    it("returns 200 with an empty entries array for an unknown MSISDN", async () => {
      const req = makeRequest("0340000000");
      const ctx = makeContext("0340000000");

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({ msisdn: "0340000000", entries: [] });
    });
  });

  describe("pure-deposit history", () => {
    it("returns only transaction entries tagged with kind: transaction", async () => {
      createTransaction({
        msisdn: "0340000001",
        direction: "deposit",
        amount: 1000,
        correlationId: "corr-01",
        walletSettled: true,
      });

      const req = makeRequest("0340000001");
      const ctx = makeContext("0340000001");

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.msisdn).toBe("0340000001");
      expect(json.entries).toHaveLength(1);
      expect(json.entries[0].kind).toBe("transaction");
      expect(json.entries[0].direction).toBe("deposit");
      expect(json.entries[0].amount).toBe(1000);
      expect(json.entries[0]).not.toHaveProperty("_sortKey");
    });

    it("transaction entry has the correct shape", async () => {
      createTransaction({
        msisdn: "0340000002",
        direction: "deposit",
        amount: 500,
        correlationId: "corr-02",
        walletSettled: false,
      });

      const req = makeRequest("0340000002");
      const ctx = makeContext("0340000002");

      const response = await GET(req, ctx);
      const json = await response.json();

      const entry = json.entries[0];
      expect(entry).toHaveProperty("kind", "transaction");
      expect(entry).toHaveProperty("localTxId");
      expect(entry).toHaveProperty("correlationId", "corr-02");
      expect(entry).toHaveProperty("direction", "deposit");
      expect(entry).toHaveProperty("amount", 500);
      expect(entry).toHaveProperty("status");
      expect(entry).toHaveProperty("walletSettled", false);
      expect(entry).toHaveProperty("createdAt");
      expect(entry).toHaveProperty("updatedAt");
      expect(entry).not.toHaveProperty("_sortKey");
    });

    it("does not include transactions for a different MSISDN", async () => {
      createTransaction({
        msisdn: "0340000003",
        direction: "deposit",
        amount: 2000,
        correlationId: "corr-03",
        walletSettled: true,
      });

      const req = makeRequest("0340000099");
      const ctx = makeContext("0340000099");

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(json.entries).toHaveLength(0);
    });
  });

  describe("pure-game history", () => {
    it("returns only game entries tagged with kind: game", async () => {
      recordGameSession({
        msisdn: "0340000010",
        bet: 100,
        choice: "heads",
        outcome: "heads",
        result: "win",
        delta: 100,
        balanceAfter: 1100,
      });

      const req = makeRequest("0340000010");
      const ctx = makeContext("0340000010");

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.msisdn).toBe("0340000010");
      expect(json.entries).toHaveLength(1);
      expect(json.entries[0].kind).toBe("game");
      expect(json.entries[0].bet).toBe(100);
      expect(json.entries[0]).not.toHaveProperty("_sortKey");
    });

    it("game entry has the correct shape", async () => {
      recordGameSession({
        msisdn: "0340000011",
        bet: 200,
        choice: "tails",
        outcome: "heads",
        result: "loss",
        delta: -200,
        balanceAfter: 800,
      });

      const req = makeRequest("0340000011");
      const ctx = makeContext("0340000011");

      const response = await GET(req, ctx);
      const json = await response.json();

      const entry = json.entries[0];
      expect(entry).toHaveProperty("kind", "game");
      expect(entry).toHaveProperty("sessionId");
      expect(entry).toHaveProperty("bet", 200);
      expect(entry).toHaveProperty("choice", "tails");
      expect(entry).toHaveProperty("outcome", "heads");
      expect(entry).toHaveProperty("result", "loss");
      expect(entry).toHaveProperty("delta", -200);
      expect(entry).toHaveProperty("balanceAfter", 800);
      expect(entry).toHaveProperty("playedAt");
      expect(entry).not.toHaveProperty("_sortKey");
      expect(entry).not.toHaveProperty("msisdn");
    });
  });

  describe("mixed history with correct sort order", () => {
    it("merges transactions and games sorted by timestamp descending", async () => {
      const msisdn = "0340000020";

      // Create entries with controlled timing
      // We'll rely on Date.now() ordering; create them in sequence
      createTransaction({
        msisdn,
        direction: "deposit",
        amount: 5000,
        correlationId: "corr-mixed-01",
        walletSettled: true,
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 2));

      recordGameSession({
        msisdn,
        bet: 500,
        choice: "heads",
        outcome: "tails",
        result: "loss",
        delta: -500,
        balanceAfter: 4500,
      });

      await new Promise((resolve) => setTimeout(resolve, 2));

      createTransaction({
        msisdn,
        direction: "deposit",
        amount: 1000,
        correlationId: "corr-mixed-02",
        walletSettled: false,
      });

      const req = makeRequest(msisdn);
      const ctx = makeContext(msisdn);

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(json.entries).toHaveLength(3);

      // Most recent first
      expect(json.entries[0].kind).toBe("transaction");
      expect(json.entries[0].amount).toBe(1000);

      expect(json.entries[1].kind).toBe("game");
      expect(json.entries[1].bet).toBe(500);

      expect(json.entries[2].kind).toBe("transaction");
      expect(json.entries[2].amount).toBe(5000);
    });

    it("uses createdAt for transactions and playedAt for games as the sort key", async () => {
      const msisdn = "0340000021";

      createTransaction({
        msisdn,
        direction: "deposit",
        amount: 3000,
        correlationId: "corr-sort-01",
        walletSettled: true,
      });

      await new Promise((resolve) => setTimeout(resolve, 2));

      recordGameSession({
        msisdn,
        bet: 300,
        choice: "tails",
        outcome: "tails",
        result: "win",
        delta: 300,
        balanceAfter: 3300,
      });

      const req = makeRequest(msisdn);
      const ctx = makeContext(msisdn);

      const response = await GET(req, ctx);
      const json = await response.json();

      expect(json.entries).toHaveLength(2);
      // Game was created last, so it appears first
      expect(json.entries[0].kind).toBe("game");
      expect(json.entries[1].kind).toBe("transaction");
    });

    it("does not include the internal _sortKey in any entry", async () => {
      const msisdn = "0340000022";

      createTransaction({
        msisdn,
        direction: "deposit",
        amount: 1000,
        correlationId: "corr-key-01",
        walletSettled: true,
      });

      recordGameSession({
        msisdn,
        bet: 100,
        choice: "heads",
        outcome: "heads",
        result: "win",
        delta: 100,
        balanceAfter: 1100,
      });

      const req = makeRequest(msisdn);
      const ctx = makeContext(msisdn);

      const response = await GET(req, ctx);
      const json = await response.json();

      for (const entry of json.entries) {
        expect(entry).not.toHaveProperty("_sortKey");
      }
    });
  });
});
