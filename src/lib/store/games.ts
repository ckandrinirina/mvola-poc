import { GameSession, GameChoice, GameResult } from "@/lib/mvola/types";

const sessions = new Map<string, GameSession>();

interface RecordInput {
  msisdn: string;
  bet: number;
  choice: GameChoice;
  outcome: GameChoice;
  result: GameResult;
  delta: number;
  balanceAfter: number;
}

export function recordGameSession(input: RecordInput): GameSession {
  if (!Number.isInteger(input.bet) || input.bet <= 0) {
    throw new Error(`bet must be a positive integer, got ${input.bet}`);
  }
  if (!Number.isInteger(input.balanceAfter) || input.balanceAfter < 0) {
    throw new Error(`balanceAfter must be a non-negative integer`);
  }
  const session: GameSession = {
    sessionId: crypto.randomUUID(),
    playedAt: Date.now(),
    ...input,
  };
  sessions.set(session.sessionId, session);
  return session;
}

export function listGameSessionsByMsisdn(msisdn: string): GameSession[] {
  return Array.from(sessions.values())
    .filter((s) => s.msisdn === msisdn)
    .sort((a, b) => b.playedAt - a.playedAt);
}

export function resetAll(): void {
  sessions.clear();
}
