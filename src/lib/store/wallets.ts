import { WalletState, InsufficientFundsError } from "@/lib/mvola/types";

const wallets = new Map<string, WalletState>();

function assertPositiveInteger(n: number, label: string): void {
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} must be a positive integer, got ${n}`);
  }
}

export function getWallet(msisdn: string): WalletState | undefined {
  return wallets.get(msisdn);
}

export function ensureWallet(msisdn: string): WalletState {
  const existing = wallets.get(msisdn);
  if (existing) return existing;
  const now = Date.now();
  const fresh: WalletState = { msisdn, balance: 0, createdAt: now, updatedAt: now };
  wallets.set(msisdn, fresh);
  return fresh;
}

export function creditWallet(msisdn: string, amount: number): WalletState {
  assertPositiveInteger(amount, "amount");
  const w = ensureWallet(msisdn);
  w.balance += amount;
  w.updatedAt = Date.now();
  return w;
}

export function debitWallet(msisdn: string, amount: number): WalletState {
  assertPositiveInteger(amount, "amount");
  const w = wallets.get(msisdn);
  const current = w?.balance ?? 0;
  if (current < amount) {
    throw new InsufficientFundsError(current, amount);
  }
  w!.balance -= amount;
  w!.updatedAt = Date.now();
  return w!;
}

export function resetAll(): void {
  wallets.clear();
}
