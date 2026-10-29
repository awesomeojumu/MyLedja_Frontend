import type { Account, StoredEvent } from '@/data/workspace/model';
import { ACCOUNT_KIND_INFO } from '@/data/workspace/model';

import { localFromServer } from './serverRecords';
import type { Change, LocalRecord, Operation, OperationResult } from './types';

/** BE push body operation (TECH-SPEC 9 / B1.11). */
export type BackendOperation = {
  operationId: string;
  type: string;
  targetId?: string | null;
  payload: Record<string, unknown>;
  baseVersion?: number | null;
  /** Ids this device made for the transactions the operation posts, in posting order. */
  transactionIds?: string[];
  createdAt: string;
  schemaVersion: number;
};

/**
 * The exact API operation a local write stands for. The repository attaches it when one action writes several
 * local records (a debt, its first event and its history row), so the server gets the action once. `null` marks
 * a write the server derives itself and never needs to receive.
 */
export type RemoteOperation = {
  type: string;
  targetId?: string | null;
  payload: Record<string, unknown>;
  baseVersion?: number | null;
  transactionIds?: string[];
};

export type BackendOperationResult = {
  operationId: string;
  status: 'applied' | 'duplicate' | 'conflict' | 'rejected';
  result: unknown;
  current: unknown;
  error: { code?: string; message?: string; field?: string } | null;
};

export type BackendChange = {
  seq: string;
  collection: string;
  id: string;
  op: 'upsert' | 'tombstone';
  doc: unknown;
};

type AccountRef = { id: string; kind: 'asset' | 'liability'; systemKey: string | null };

function accountRefs(accounts: Account[]): Map<string, AccountRef> {
  const map = new Map<string, AccountRef>();
  for (const a of accounts) {
    const kind = ACCOUNT_KIND_INFO[a.type].ledger;
    if (kind !== 'asset' && kind !== 'liability') continue;
    map.set(a.id, { id: a.id, kind, systemKey: null });
  }
  return map;
}

function isReal(a: AccountRef | null | undefined) {
  return !!a && (a.kind === 'asset' || a.kind === 'liability') && a.systemKey === null;
}

/** Rebuild a create-transaction body from a locally stored event (mirrors BE inputOf for Phase 1 types). */
export function eventInputFromStored(
  data: StoredEvent & { operationId?: string },
  accounts: Account[],
): Record<string, unknown> | null {
  const refs = accountRefs(accounts);
  const lines = data.lines.map((l) => ({
    ledgerAccountId: l.a,
    amountMinor: BigInt(l.m),
    currency: l.c,
    categoryId: refs.has(l.a) ? null : l.a,
  }));
  const common = {
    date: data.date,
    payeeId: data.payeeId ?? null,
    notes: data.notes ?? null,
  };
  const real = lines.filter((l) => isReal(refs.get(l.ledgerAccountId)));
  const cats = lines.filter((l) => !isReal(refs.get(l.ledgerAccountId)));

  switch (data.type) {
    case 'income':
      if (!real[0] || !cats[0]) return null;
      return {
        type: 'income',
        accountId: real[0].ledgerAccountId,
        categoryId: cats[0].ledgerAccountId,
        amount: real[0].amountMinor.toString(),
        ...common,
      };
    case 'expense': {
      if (!real[0]) return null;
      const total = (-real[0].amountMinor).toString();
      if (cats.length <= 1) {
        return {
          type: 'expense',
          accountId: real[0].ledgerAccountId,
          categoryId: cats[0]?.ledgerAccountId,
          amount: total,
          ...common,
        };
      }
      return {
        type: 'expense',
        accountId: real[0].ledgerAccountId,
        amount: total,
        splits: cats.map((l) => ({ categoryId: l.ledgerAccountId, amount: l.amountMinor.toString() })),
        ...common,
      };
    }
    case 'transfer': {
      const from = real.find((l) => l.amountMinor < 0n);
      const to = real.find((l) => l.amountMinor > 0n);
      if (!from || !to) return null;
      return {
        type: 'transfer',
        fromAccountId: from.ledgerAccountId,
        toAccountId: to.ledgerAccountId,
        amount: (-from.amountMinor).toString(),
        ...(from.currency !== to.currency ? { toAmount: to.amountMinor.toString() } : {}),
        ...common,
      };
    }
    case 'opening_balance': {
      if (!real[0]) return null;
      const a = refs.get(real[0].ledgerAccountId);
      if (!a) return null;
      const shown = a.kind === 'liability' ? -real[0].amountMinor : real[0].amountMinor;
      return { type: 'opening_balance', accountId: a.id, amount: shown.toString(), ...common };
    }
    case 'balance_adjustment': {
      if (!real[0]) return null;
      const a = refs.get(real[0].ledgerAccountId);
      if (!a) return null;
      const shown = a.kind === 'liability' ? -real[0].amountMinor : real[0].amountMinor;
      return {
        type: 'balance_adjustment',
        accountId: a.id,
        amount: shown.toString(),
        reason: 'reconcile',
        ...common,
      };
    }
    case 'refund':
      if (!real[0] || !data.refundOf) return null;
      return {
        type: 'refund',
        refundOf: data.refundOf,
        accountId: real[0].ledgerAccountId,
        categoryId: cats[0]?.ledgerAccountId,
        amount: real[0].amountMinor.toString(),
        ...common,
      };
    default:
      return null;
  }
}

const BE_TYPES = new Set([
  'transaction.create',
  'transaction.correct',
  'transaction.reverse',
  'transaction.update',
  'account.create',
  'account.update',
  'category.create',
  'category.update',
  'payee.create',
  'payee.update',
  'tag.create',
  'budget.assign',
  'budget.template.save',
  'schedule.create',
  'schedule.update',
  'schedule.cancel',
  'occurrence.mark_paid',
  'occurrence.mark_received',
  'occurrence.unmark',
  'goal.create',
  'goal.update',
  'goal.allocate',
  'debt.lend',
  'debt.borrow',
  'debt.payment',
  'debt.write_off',
  'income.stream.create',
  'income.stream.update',
]);

/**
 * Map a local outbox operation to the backend sync contract.
 * Local writes use `{ collection, id, data }`; the server wants route bodies.
 */
export function toBackendOperation(op: Operation, accounts: Account[]): BackendOperation | { reject: string } | { local: true } {
  if ('remote' in op.payload) {
    const remote = op.payload.remote as RemoteOperation | null;
    if (remote === null) return { local: true };
    return {
      operationId: op.operationId,
      type: remote.type,
      targetId: remote.targetId ?? null,
      payload: remote.payload,
      baseVersion: remote.baseVersion ?? op.baseVersion ?? null,
      transactionIds: remote.transactionIds,
      createdAt: op.createdAt,
      schemaVersion: op.schemaVersion,
    };
  }
  if (BE_TYPES.has(op.type) && !('collection' in op.payload && 'data' in op.payload)) {
    return {
      operationId: op.operationId,
      type: op.type,
      targetId: typeof op.payload.targetId === 'string' ? op.payload.targetId : null,
      payload: op.payload,
      baseVersion: op.baseVersion ?? null,
      createdAt: op.createdAt,
      schemaVersion: op.schemaVersion,
    };
  }

  const collection = String(op.payload.collection ?? '');
  const id = String(op.payload.id ?? '');
  const data = (op.payload.data ?? {}) as Record<string, unknown>;

  if (op.type.startsWith('event.')) {
    const eventType = op.type.slice('event.'.length);
    if (eventType === 'reversal') {
      const targetId = typeof data.reversalOf === 'string' ? data.reversalOf : null;
      if (!targetId) return { reject: 'missing_target' };
      return {
        operationId: op.operationId,
        type: 'transaction.reverse',
        targetId,
        payload: { baseVersion: op.baseVersion ?? 0 },
        baseVersion: op.baseVersion ?? null,
        transactionIds: [id],
        createdAt: op.createdAt,
        schemaVersion: op.schemaVersion,
      };
    }
    // Unlock goes through POST …/transactions/:id/unlock (REST), not sync ops.
    if (eventType === 'unlock') return { local: true };
    if (eventType === 'notes' || eventType === 'meta' || eventType === 'payee' || eventType === 'link_stream' || eventType === 'one_off') {
      return {
        operationId: op.operationId,
        type: 'transaction.update',
        targetId: id,
        payload: {
          baseVersion: op.baseVersion ?? 0,
          notes: data.notes ?? undefined,
          payeeId: data.payeeId ?? undefined,
        },
        baseVersion: op.baseVersion ?? null,
        createdAt: op.createdAt,
        schemaVersion: op.schemaVersion,
      };
    }
    const input = eventInputFromStored(data as StoredEvent, accounts);
    if (!input) return { reject: 'unsupported_event' };
    return {
      operationId: op.operationId,
      type: 'transaction.create',
      payload: input,
      baseVersion: op.baseVersion ?? null,
      transactionIds: [id],
      createdAt: op.createdAt,
      schemaVersion: op.schemaVersion,
    };
  }

  if (op.type === 'account.create' || (collection === 'accounts' && op.type.includes('create'))) {
    return {
      operationId: op.operationId,
      type: 'account.create',
      payload: {
        id,
        type: data.type,
        name: data.name,
        institution: data.institution ?? null,
        last4: data.last4 ?? undefined,
        currency: data.currency ?? 'NGN',
        onBudget: data.countInBudget ?? true,
        openingBalance: '0',
        openingDate: new Date().toISOString().slice(0, 10),
      },
      createdAt: op.createdAt,
      schemaVersion: op.schemaVersion,
    };
  }

  if (op.type === 'account.update' || (collection === 'accounts' && op.type.includes('update'))) {
    return {
      operationId: op.operationId,
      type: 'account.update',
      targetId: id,
      payload: {
        baseVersion: op.baseVersion ?? 0,
        name: data.name,
        institution: data.institution ?? null,
        last4: data.last4,
        onBudget: data.countInBudget,
      },
      baseVersion: op.baseVersion ?? null,
      createdAt: op.createdAt,
      schemaVersion: op.schemaVersion,
    };
  }

  if (op.type === 'payee.create' || collection === 'payees') {
    const create = op.type.includes('create');
    return create
      ? {
          operationId: op.operationId,
          type: 'payee.create',
          payload: { id, name: data.name, defaultCategoryId: data.defaultCategoryId ?? null },
          createdAt: op.createdAt,
          schemaVersion: op.schemaVersion,
        }
      : {
          operationId: op.operationId,
          type: 'payee.update',
          targetId: id,
          payload: { baseVersion: op.baseVersion ?? 0, name: data.name, defaultCategoryId: data.defaultCategoryId ?? null },
          baseVersion: op.baseVersion ?? null,
          createdAt: op.createdAt,
          schemaVersion: op.schemaVersion,
        };
  }

  if (op.type === 'category.create' || (collection === 'categories' && op.type !== 'category.delete' && op.type !== 'category.undo_delete')) {
    const create = op.type.includes('create');
    const type =
      data.budgetType === 'nonMonthly' ? 'non_monthly' : typeof data.budgetType === 'string' ? data.budgetType : undefined;
    const groupId = typeof data.group === 'string' && /^[0-9a-f-]{36}$/i.test(data.group) ? data.group : undefined;
    return create
      ? {
          operationId: op.operationId,
          type: 'category.create',
          payload: {
            id,
            name: data.name,
            ...(groupId ? { groupId } : {}),
            icon: data.icon ?? null,
            type: type ?? null,
            budgetable: data.countInBudget,
            carryOver: data.carryOver === true,
            essential: data.essential === true,
          },
          createdAt: op.createdAt,
          schemaVersion: op.schemaVersion,
        }
      : {
          operationId: op.operationId,
          type: 'category.update',
          targetId: id,
          payload: {
            baseVersion: op.baseVersion ?? 0,
            name: data.name,
            ...(groupId ? { groupId } : {}),
            icon: data.icon ?? null,
            type: type ?? null,
            hidden: data.hidden === true,
            budgetable: data.countInBudget,
            carryOver: data.carryOver === true,
            essential: data.essential === true,
            sortOrder: typeof data.order === 'number' ? data.order : undefined,
          },
          baseVersion: op.baseVersion ?? null,
          createdAt: op.createdAt,
          schemaVersion: op.schemaVersion,
        };
  }

  return { reject: 'unsupported_operation' };
}

function asRecord(collection: string, id: string, doc: unknown, version = 1): LocalRecord {
  const data =
    doc && typeof doc === 'object'
      ? ({ ...(doc as Record<string, unknown>) } as Record<string, unknown>)
      : { value: doc };
  const v = typeof (doc as { version?: number } | null)?.version === 'number' ? (doc as { version: number }).version : version;
  return { id, collection, version: v, data };
}

const SERVER_COLLECTION: [string, string][] = [
  ['transaction.', 'transactions'],
  ['account.', 'accounts'],
  ['category.', 'categories'],
  ['payee.', 'payees'],
  ['tag.', 'tags'],
  ['budget.', 'budget_months'],
  ['schedule.', 'schedules'],
  ['goal.', 'goals'],
  ['debt.', 'debts'],
  ['income.stream.', 'income_streams'],
];

/**
 * Map a backend operation result into the engine's result shape. Applied changes come back through the pull,
 * already translated, so only a conflict carries the server's version here.
 */
export function fromBackendResult(result: BackendOperationResult, opType: string, workspaceId: string): OperationResult {
  if (result.status === 'rejected') {
    return {
      operationId: result.operationId,
      status: 'rejected',
      error: result.error?.message ?? result.error?.code ?? 'rejected',
    };
  }
  if (result.status === 'conflict') {
    const current = result.current as Record<string, unknown> | null;
    const collection = SERVER_COLLECTION.find(([prefix]) => opType.startsWith(prefix))?.[1] ?? 'transactions';
    const id = current && typeof current.id === 'string' ? current.id : 'unknown';
    const record = localFromServer(collection, id, current, workspaceId) ?? asRecord(collection, id, current);
    return { operationId: result.operationId, status: 'conflict', record };
  }
  return { operationId: result.operationId, status: result.status === 'duplicate' ? 'duplicate' : 'applied' };
}

const LOCAL_COLLECTION: Record<string, string> = {
  transactions: 'events',
  budget_months: 'budget_assigns',
  schedules: 'recurring',
  goal_allocations: 'allocations',
  reconciliations: 'reconciles',
};

/** One change from the feed, as the local change it stands for; null when the app keeps no copy. */
export function fromBackendChange(change: BackendChange, workspaceId: string): Change | null {
  const seq = Number(change.seq);
  if (change.op === 'tombstone') {
    return { seq, op: 'tombstone', collection: LOCAL_COLLECTION[change.collection] ?? change.collection, id: change.id };
  }
  const record = localFromServer(change.collection, change.id, change.doc, workspaceId);
  return record ? { seq, op: 'upsert', record } : null;
}
