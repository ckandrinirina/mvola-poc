/**
 * Transaction Store — in-memory log of every deposit and cash-out.
 *
 * Primary index:    Map<localTxId, TransactionRecord>
 * Secondary index:  Map<correlationId, localTxId>    (for O(1) status lookups)
 * Tertiary index:   Map<mvolaReference, localTxId>   (for O(1) lookup by settled reference)
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
const byMvolaReference = new Map<string, string>(); // mvolaReference → localTxId

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
 * Looks up a transaction by its settled MVola reference (O(1) via tertiary index).
 * An empty string never resolves — no reference is ever indexed under it.
 */
export function getTransactionByMvolaReference(
  reference: string
): TransactionRecord | undefined {
  if (!reference) return undefined;
  const localTxId = byMvolaReference.get(reference);
  if (localTxId === undefined) return undefined;
  return byId.get(localTxId);
}

/**
 * Updates the status of an existing transaction and optionally patches
 * `mvolaReference` and/or `walletSettled`.
 *
 * A falsy `patch.mvolaReference` (`undefined` or `""`) means "no new
 * information" — it never clears a previously stored reference and is
 * never indexed.
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

  if (patch?.mvolaReference) {
    updated.mvolaReference = patch.mvolaReference;
    byMvolaReference.set(patch.mvolaReference, localTxId);
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
 * Clears the primary, secondary, and tertiary maps.
 * Intended for use in tests only.
 */
export function resetAll(): void {
  byId.clear();
  byCorrelationId.clear();
  byMvolaReference.clear();
}
