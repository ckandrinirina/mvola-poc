import {
  recordGameSession,
  listGameSessionsByMsisdn,
  resetAll,
} from "@/lib/store/games";

const BASE_INPUT = {
  msisdn: "0341234567",
  bet: 500,
  choice: "heads" as const,
  outcome: "heads" as const,
  result: "win" as const,
  delta: 500,
  balanceAfter: 1500,
};

beforeEach(() => {
  resetAll();
});

describe("recordGameSession", () => {
  it("returns a GameSession with generated sessionId and playedAt", () => {
    const before = Date.now();
    const session = recordGameSession(BASE_INPUT);
    const after = Date.now();

    expect(session.sessionId).toBeDefined();
    expect(typeof session.sessionId).toBe("string");
    expect(session.sessionId.length).toBeGreaterThan(0);
    expect(session.playedAt).toBeGreaterThanOrEqual(before);
    expect(session.playedAt).toBeLessThanOrEqual(after);
  });

  it("copies all input fields onto the returned session", () => {
    const session = recordGameSession(BASE_INPUT);

    expect(session.msisdn).toBe(BASE_INPUT.msisdn);
    expect(session.bet).toBe(BASE_INPUT.bet);
    expect(session.choice).toBe(BASE_INPUT.choice);
    expect(session.outcome).toBe(BASE_INPUT.outcome);
    expect(session.result).toBe(BASE_INPUT.result);
    expect(session.delta).toBe(BASE_INPUT.delta);
    expect(session.balanceAfter).toBe(BASE_INPUT.balanceAfter);
  });

  it("generates unique sessionIds for each call", () => {
    const s1 = recordGameSession(BASE_INPUT);
    const s2 = recordGameSession(BASE_INPUT);
    expect(s1.sessionId).not.toBe(s2.sessionId);
  });

  it("throws if bet is zero", () => {
    expect(() => recordGameSession({ ...BASE_INPUT, bet: 0 })).toThrow(
      /bet must be a positive integer/
    );
  });

  it("throws if bet is negative", () => {
    expect(() => recordGameSession({ ...BASE_INPUT, bet: -100 })).toThrow(
      /bet must be a positive integer/
    );
  });

  it("throws if bet is a float", () => {
    expect(() => recordGameSession({ ...BASE_INPUT, bet: 1.5 })).toThrow(
      /bet must be a positive integer/
    );
  });

  it("throws if balanceAfter is negative", () => {
    expect(() =>
      recordGameSession({ ...BASE_INPUT, balanceAfter: -1 })
    ).toThrow(/balanceAfter must be a non-negative integer/);
  });

  it("throws if balanceAfter is a float", () => {
    expect(() =>
      recordGameSession({ ...BASE_INPUT, balanceAfter: 0.5 })
    ).toThrow(/balanceAfter must be a non-negative integer/);
  });

  it("accepts balanceAfter = 0 (all-in loss)", () => {
    const session = recordGameSession({ ...BASE_INPUT, balanceAfter: 0 });
    expect(session.balanceAfter).toBe(0);
  });
});

describe("listGameSessionsByMsisdn", () => {
  it("returns empty array when no sessions exist", () => {
    expect(listGameSessionsByMsisdn("0341234567")).toEqual([]);
  });

  it("returns sessions for the given msisdn", () => {
    recordGameSession(BASE_INPUT);
    const sessions = listGameSessionsByMsisdn(BASE_INPUT.msisdn);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].msisdn).toBe(BASE_INPUT.msisdn);
  });

  it("sorts sessions newest-first by playedAt", async () => {
    const s1 = recordGameSession(BASE_INPUT);
    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));
    const s2 = recordGameSession(BASE_INPUT);

    const sessions = listGameSessionsByMsisdn(BASE_INPUT.msisdn);
    expect(sessions[0].sessionId).toBe(s2.sessionId);
    expect(sessions[1].sessionId).toBe(s1.sessionId);
  });

  it("isolates sessions by msisdn (multi-msisdn isolation)", () => {
    recordGameSession({ ...BASE_INPUT, msisdn: "0341111111" });
    recordGameSession({ ...BASE_INPUT, msisdn: "0342222222" });
    recordGameSession({ ...BASE_INPUT, msisdn: "0341111111" });

    const sessions1 = listGameSessionsByMsisdn("0341111111");
    const sessions2 = listGameSessionsByMsisdn("0342222222");

    expect(sessions1).toHaveLength(2);
    expect(sessions2).toHaveLength(1);

    sessions1.forEach((s) => expect(s.msisdn).toBe("0341111111"));
    sessions2.forEach((s) => expect(s.msisdn).toBe("0342222222"));
  });
});

describe("resetAll", () => {
  it("clears all sessions", () => {
    recordGameSession(BASE_INPUT);
    resetAll();
    expect(listGameSessionsByMsisdn(BASE_INPUT.msisdn)).toEqual([]);
  });

  it("clears sessions across all msisdns", () => {
    recordGameSession({ ...BASE_INPUT, msisdn: "0341111111" });
    recordGameSession({ ...BASE_INPUT, msisdn: "0342222222" });
    resetAll();
    expect(listGameSessionsByMsisdn("0341111111")).toEqual([]);
    expect(listGameSessionsByMsisdn("0342222222")).toEqual([]);
  });
});
