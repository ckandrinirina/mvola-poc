/**
 * Transaction Store — in-memory log of every deposit and cash-out.
 *
 * Primary index:   Map<localTxId, TransactionRecord>
 * Secondary index: Map<correlationId, localTxId>  (for O(1) status lookups)
 *
 * All maps are module-private; access is via the exported functions only.
 */

import {
  TransactionRecord,
  TransactionDirection,
  TransactionStatus,
} from "@/lib/mvola/types";

// --- Module-private state ---

const byId = new Map<string, TransactionRecord>();
const byCorrelationId = new Map<string, string>(); // correlationId → localTxId

// --- Input types ---

export interface CreateTransactionInput {
  msisdn: string;
  direction: TransactionDirection;
  amount: number;
  correlationId: string;
  walletSettled: boolean;
}

export interface UpdateTransactionPatch {
  mvolaReference?: string;
  walletSettled?: boolean;
}

// --- Public API ---

/**
 * Creates a new transaction record and inserts it into both indexes.
 *
 * @throws Error if `amount` is not a positive integer.
 * @throws Error if `correlationId` already exists.
 */
export function createTransaction(
  input: CreateTransactionInput
): TransactionRecord {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error(
      `amount must be a positive integer, got ${input.amount}`
    );
  }
  if (byCorrelationId.has(input.correlationId)) {
    throw new Error(`Duplicate correlationId: ${input.correlationId}`);
  }

  const now = Date.now();
  const record: TransactionRecord = {
    localTxId: crypto.randomUUID(),
    correlationId: input.correlationId,
    msisdn: input.msisdn,
    direction: input.direction,
    amount: input.amount,
    status: "pending",
    walletSettled: input.walletSettled,
    createdAt: now,
    updatedAt: now,
  };

  byId.set(record.localTxId, record);
  byCorrelationId.set(record.correlationId, record.localTxId);

  return record;
}

/**
 * Looks up a transaction by its MVola server correlation ID (O(1) via secondary index).
 */
export function getTransactionByCorrelationId(
  correlationId: string
): TransactionRecord | undefined {
  const localTxId = byCorrelationId.get(correlationId);
  if (localTxId === undefined) return undefined;
  return byId.get(localTxId);
}

/**
 * Looks up a transaction by its local transaction ID (O(1) via primary map).
 */
export function getTransactionById(
  localTxId: string
): TransactionRecord | undefined {
  return byId.get(localTxId);
}

/**
 * Updates the status of an existing transaction and optionally patches
 * `mvolaReference` and/or `walletSettled`.
 *
 * @throws Error if the record does not exist.
 */
export function updateTransactionStatus(
  localTxId: string,
  status: TransactionStatus,
  patch?: UpdateTransactionPatch
): TransactionRecord {
  const record = byId.get(localTxId);
  if (record === undefined) {
    throw new Error(`Transaction not found: ${localTxId}`);
  }

  const updated: TransactionRecord = {
    ...record,
    status,
    updatedAt: Date.now(),
  };

  if (patch?.mvolaReference !== undefined) {
    updated.mvolaReference = patch.mvolaReference;
  }
  if (patch?.walletSettled !== undefined) {
    updated.walletSettled = patch.walletSettled;
  }

  byId.set(localTxId, updated);
  return updated;
}

/**
 * Returns all transactions for a given MSISDN, sorted by `createdAt` descending
 * (most recent first).
 */
export function listTransactionsByMsisdn(msisdn: string): TransactionRecord[] {
  return Array.from(byId.values())
    .filter((r) => r.msisdn === msisdn)
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Clears both the primary and secondary maps.
 * Intended for use in tests only.
 */
export function resetAll(): void {
  byId.clear();
  byCorrelationId.clear();
}
