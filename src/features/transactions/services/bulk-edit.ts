import { rowKind, type ApiTransaction } from "@/lib/money-map";

/** What a bulk change sets. Only the given fields change; everything else is copied from the original. */
export interface BulkPatch {
  categoryId?: string;
  accountId?: string;
  /** YYYY-MM-DD; the original time of day is kept. */
  date?: string;
}

/** Same moment of day, different date, in local time. */
export function withDate(occurredAt: string | undefined, date: string, now: Date = new Date()): string {
  const [y, m, d] = date.split("-").map(Number);
  const base = occurredAt ? new Date(occurredAt) : now;
  const valid = Number.isNaN(base.getTime()) ? now : base;
  return new Date(y, m - 1, d, valid.getHours(), valid.getMinutes(), valid.getSeconds(), valid.getMilliseconds()).toISOString();
}

/** Why a row can't take this patch, or null when it can. Rows that can't are skipped, not failed. */
export function skipReason(tx: ApiTransaction, patch: BulkPatch): string | null {
  const kind = rowKind(tx.type);
  if (patch.categoryId && kind === "transfer") return "Transfers don't have categories";
  if (patch.accountId && tx.toAccountId && String(tx.toAccountId) === patch.accountId) return "A transfer can't go to the account it comes from";
  return null;
}

/** True when the patch would change nothing for this row, so it isn't rewritten. */
export function unchanged(tx: ApiTransaction, patch: BulkPatch): boolean {
  if (patch.categoryId && patch.categoryId !== tx.categoryId) return false;
  if (patch.accountId && patch.accountId !== tx.accountId) return false;
  if (patch.date) {
    const d = tx.occurredAt ? new Date(tx.occurredAt) : null;
    const key = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "";
    if (key !== patch.date) return false;
  }
  return true;
}

/**
 * The replacement for a corrected row. Corrections void the original and post this copy, so the copy keeps
 * every field (type, amount, both accounts, category, description, date) except the ones being changed.
 */
export function correctedCopy(tx: ApiTransaction, patch: BulkPatch, operationId: string): Record<string, unknown> {
  const body: Record<string, unknown> = {
    operationId,
    type: tx.type ?? "expense",
    amount: tx.amount ?? "0.00",
    accountId: patch.accountId ?? tx.accountId,
    description: tx.description ?? "",
    status: "posted",
  };
  const categoryId = patch.categoryId ?? tx.categoryId;
  if (categoryId) body.categoryId = categoryId;
  if (tx.toAccountId) body.toAccountId = tx.toAccountId;
  const occurredAt = patch.date ? withDate(tx.occurredAt, patch.date) : tx.occurredAt;
  if (occurredAt) body.occurredAt = occurredAt;
  return body;
}

export interface BulkResult {
  done: number;
  skipped: number;
  failed: number;
}

interface BulkSession {
  setTransactionStatus: (workspaceId: string, transactionId: string, status: string) => Promise<unknown>;
  createTransaction: (workspaceId: string, body: unknown) => Promise<unknown>;
}

/** Apply a patch to each row in turn: post the corrected copy first, then void the original, so a failure never loses a row. */
export async function applyBulk(session: BulkSession, workspaceId: string, rows: ApiTransaction[], patch: BulkPatch, makeId: () => string): Promise<BulkResult> {
  const result: BulkResult = { done: 0, skipped: 0, failed: 0 };
  for (const tx of rows) {
    if (skipReason(tx, patch) || unchanged(tx, patch)) {
      result.skipped += 1;
      continue;
    }
    let copyId: string | undefined;
    try {
      const res = (await session.createTransaction(workspaceId, correctedCopy(tx, patch, makeId()))) as { data?: { id?: string } } | undefined;
      copyId = res?.data?.id;
      await session.setTransactionStatus(workspaceId, tx.id, "voided");
      result.done += 1;
    } catch {
      // The original couldn't be voided: take the copy back out so the row isn't counted twice.
      if (copyId) await session.setTransactionStatus(workspaceId, copyId, "voided").catch(() => undefined);
      result.failed += 1;
    }
  }
  return result;
}

export async function voidBulk(session: BulkSession, workspaceId: string, rows: ApiTransaction[]): Promise<BulkResult> {
  const result: BulkResult = { done: 0, skipped: 0, failed: 0 };
  for (const tx of rows) {
    try {
      await session.setTransactionStatus(workspaceId, tx.id, "voided");
      result.done += 1;
    } catch {
      result.failed += 1;
    }
  }
  return result;
}

/** "Moved 3 to Transport" / "Moved 2 · 1 skipped" / "2 couldn't be changed. Try again." */
export function bulkMessage(verb: string, r: BulkResult): string {
  const parts = [`${verb} ${r.done}`];
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  if (r.failed) parts.push(`${r.failed} couldn't be changed`);
  return parts.join(" · ");
}

export interface FeedFilters {
  categoryIds: string[];
  accountIds: string[];
  /** Naira; null means no limit. */
  min: number | null;
  max: number | null;
}

export const NO_FILTERS: FeedFilters = { categoryIds: [], accountIds: [], min: null, max: null };

export function activeFilterCount(f: FeedFilters): number {
  return (f.categoryIds.length ? 1 : 0) + (f.accountIds.length ? 1 : 0) + (f.min != null || f.max != null ? 1 : 0);
}

export function matchesFilters(tx: ApiTransaction, f: FeedFilters, amount: number): boolean {
  if (f.categoryIds.length && !(tx.categoryId && f.categoryIds.includes(tx.categoryId))) return false;
  if (f.accountIds.length && !f.accountIds.includes(String(tx.accountId)) && !(tx.toAccountId && f.accountIds.includes(String(tx.toAccountId)))) return false;
  if (f.min != null && amount < f.min) return false;
  if (f.max != null && amount > f.max) return false;
  return true;
}
