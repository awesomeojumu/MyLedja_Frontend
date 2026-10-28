import { v7 as uuidv7 } from 'uuid';

import type { SetupBody } from '@/api/auth';
import { t, type TextKey } from '@/i18n';
import {
  buildExpense,
  buildIncome,
  buildOpeningBalance,
  buildReversal,
  buildTransfer,
  Chart,
  checkEvent,
  systemAccounts,
  type ExpensePart,
  type LedgerAccount,
  type LedgerErrorCode,
  type Line,
  type MoneyEvent,
} from '@/ledger';

import type { LocalStore } from '../sync/LocalStore';
import type { SyncEngine } from '../sync/SyncEngine';
import type { LocalRecord } from '../sync/types';
import {
  ACCOUNT_KIND_INFO,
  fromStored,
  STARTER_INCOME,
  toStored,
  type Account,
  type AccountKind,
  type Category,
  type Payee,
  type StoredEvent,
} from './model';

export type TxEvent = MoneyEvent & { payeeId?: string };

export type Snapshot = {
  workspaceId: string;
  accounts: Account[];
  categories: Category[];
  payees: Payee[];
  events: TxEvent[];
  /** Events made on this device that haven't synced yet. */
  waiting: Set<string>;
  chart: Chart;
};

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: LedgerErrorCode };

export type TransactionInput =
  | { kind: 'expense'; accountId: string; parts: ExpensePart[]; date: string; payeeName?: string; notes?: string }
  | { kind: 'income'; accountId: string; categoryId: string; amount: bigint; date: string; payeeName?: string; notes?: string }
  | { kind: 'transfer'; fromId: string; toId: string; amount: bigint; date: string; notes?: string };

const record = (collection: string, id: string, data: object, version = 0): LocalRecord => ({
  id,
  collection,
  version,
  data: data as Record<string, unknown>,
});

/** Reads and writes the workspace through the local store; every write is queued for sync. */
export class WorkspaceRepository {
  constructor(
    private readonly store: LocalStore,
    private readonly engine: SyncEngine,
    readonly workspaceId: string,
    private readonly newId: () => string = uuidv7,
  ) {}

  async load(): Promise<Snapshot> {
    const [accounts, categories, payees, events, outbox] = await Promise.all([
      this.store.list('accounts'),
      this.store.list('categories'),
      this.store.list('payees'),
      this.store.list('events'),
      this.store.outbox(),
    ]);
    const reversedIds = new Set(events.map((e) => (e.data as StoredEvent).reversalOf).filter(Boolean));
    const accountList = accounts.map((r) => ({ ...(r.data as Omit<Account, 'id'>), id: r.id })).sort((a, b) => a.order - b.order);
    const categoryList = categories.map((r) => ({ ...(r.data as Omit<Category, 'id'>), id: r.id }));
    const eventList = events
      .map((r) => fromStored(r.id, String(r.data.operationId ?? r.id), r.data as StoredEvent, reversedIds.has(r.id)))
      .sort((a, b) => (a.date === b.date ? b.id.localeCompare(a.id) : b.date.localeCompare(a.date)));
    const waiting = new Set(outbox.filter((o) => (o.payload as { collection?: string }).collection === 'events').map((o) => String((o.payload as { id: string }).id)));
    return {
      workspaceId: this.workspaceId,
      accounts: accountList,
      categories: categoryList,
      payees: payees.map((r) => ({ ...(r.data as Omit<Payee, 'id'>), id: r.id })),
      events: eventList,
      waiting,
      chart: this.chartFor(accountList, categoryList),
    };
  }

  chartFor(accounts: Account[], categories: Category[]): Chart {
    const ledger: LedgerAccount[] = [
      ...accounts.map((a) => ({ id: a.id, kind: ACCOUNT_KIND_INFO[a.type].ledger, name: a.name, currency: a.currency })),
      ...categories.map((c) => ({ id: c.id, kind: c.kind, name: c.name, currency: 'NGN', categoryId: c.id, countInBudget: c.countInBudget })),
      ...systemAccounts(this.workspaceId),
    ];
    return new Chart(ledger);
  }

  private async put(collection: string, id: string, data: object, type: string, baseVersion?: number) {
    await this.engine.save(record(collection, id, data, baseVersion ?? 0), type, { collection, id, data }, baseVersion);
  }

  /** After Welcome: the accounts, categories and opening balances the person chose. */
  async seedFromSetup(body: SetupBody): Promise<void> {
    if ((await this.store.list('categories')).length > 0) return;
    for (const [i, c] of body.categories.entries()) {
      const key = c.key.startsWith('cat.') ? (c.key as TextKey) : undefined;
      await this.put('categories', this.newId(), { name: c.name, kind: 'expense', group: c.group, key, hidden: false, countInBudget: true, order: i }, 'category.create');
    }
    for (const key of STARTER_INCOME) {
      await this.put('categories', this.newId(), { name: t(key), kind: 'income', group: 'group.income', key, hidden: false, countInBudget: key !== 'cat.gift' }, 'category.create');
    }
    for (const a of body.accounts) {
      const type = (a.type in ACCOUNT_KIND_INFO ? a.type : 'other') as AccountKind;
      await this.addAccount({ name: a.name, type, openingBalance: BigInt(a.openingBalance), openingDate: a.openingDate });
    }
  }

  async addAccount(input: { name: string; type: AccountKind; institution?: string; last4?: string; countInBudget?: boolean; openingBalance: bigint; openingDate: string }): Promise<Result<Account>> {
    const snapshot = await this.load();
    const account: Account = {
      id: this.newId(),
      name: input.name,
      type: input.type,
      currency: 'NGN',
      institution: input.institution,
      last4: input.last4?.slice(-4),
      countInBudget: input.countInBudget ?? ACCOUNT_KIND_INFO[input.type].countInBudget,
      archived: false,
      order: snapshot.accounts.length,
    };
    const { id, ...data } = account;
    await this.put('accounts', id, data, 'account.create');
    if (input.openingBalance > 0n) {
      const chart = this.chartFor([...snapshot.accounts, account], snapshot.categories);
      const lines = buildOpeningBalance(chart, { accountId: id, amount: input.openingBalance });
      if (!lines.ok) return lines;
      await this.postEvent(chart, snapshot.events, { type: 'opening_balance', date: input.openingDate, lines: lines.value });
    }
    return { ok: true, value: account };
  }

  async updateAccount(account: Account): Promise<void> {
    const { id, ...data } = account;
    await this.put('accounts', id, { ...data, last4: data.last4?.slice(-4) }, 'account.update');
  }

  async addTransaction(input: TransactionInput): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const { chart } = snapshot;
    let lines;
    let splitTotal: bigint | undefined;
    if (input.kind === 'expense') {
      lines = buildExpense(chart, { accountId: input.accountId, parts: input.parts });
      if (input.parts.length > 1) splitTotal = input.parts.reduce((s, p) => s + p.amount, 0n);
    } else if (input.kind === 'income') {
      lines = buildIncome(chart, { accountId: input.accountId, categoryId: input.categoryId, amount: input.amount });
    } else {
      lines = buildTransfer(chart, { fromId: input.fromId, toId: input.toId, amount: input.amount });
    }
    if (!lines.ok) return lines;
    const payeeName = input.kind === 'transfer' ? undefined : input.payeeName?.trim();
    const payeeId = payeeName ? await this.payeeFor(snapshot.payees, payeeName, input.kind === 'expense' ? input.parts[0]?.categoryId : input.kind === 'income' ? input.categoryId : undefined) : undefined;
    return this.postEvent(chart, snapshot.events, { type: input.kind, date: input.date, lines: lines.value, splitTotal, payeeId, notes: input.notes?.trim() || undefined });
  }

  /** "Delete": a reversal (TECH-SPEC 6.3). Undo reverses the reversal's effect by posting the original again. */
  async deleteTransaction(id: string, date: string): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const original = snapshot.events.find((e) => e.id === id);
    if (!original) return { ok: false, error: 'missing_lines' };
    return this.postEvent(snapshot.chart, snapshot.events, { type: 'reversal', date, lines: buildReversal(original), reversalOf: id });
  }

  /** Undo of a delete: the original movement again, as a new event. */
  async restore(original: TxEvent): Promise<Result<TxEvent>> {
    const snapshot = await this.load();
    const { type, date, lines, splitTotal, payeeId, notes, refundOf } = original;
    return this.postEvent(snapshot.chart, snapshot.events, { type, date, lines, splitTotal, payeeId, notes, refundOf });
  }

  private async payeeFor(payees: Payee[], name: string, categoryId?: string): Promise<string> {
    const existing = payees.find((p) => p.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing.id;
    const id = this.newId();
    await this.put('payees', id, { name, defaultCategoryId: categoryId }, 'payee.create');
    return id;
  }

  private async postEvent(
    chart: Chart,
    events: TxEvent[],
    input: Omit<MoneyEvent, 'id' | 'operationId' | 'status' | 'lines'> & { lines: Line[]; payeeId?: string },
  ): Promise<Result<TxEvent>> {
    const id = this.newId();
    const event: TxEvent = { ...input, id, operationId: id, status: 'posted' };
    const checked = checkEvent(chart, event, new Map(events.map((e) => [e.id, e])));
    if (!checked.ok) return checked;
    await this.put('events', id, { ...toStored(input), operationId: id }, `event.${input.type}`);
    return { ok: true, value: event };
  }
}
