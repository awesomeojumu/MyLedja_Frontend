import type { Snapshot, TxEvent } from '@/data/workspace/repository';
import { t } from '@/i18n';
import type { LedgerErrorCode } from '@/ledger';

/** TECH-SPEC 6.4: dates are days in the workspace's time zone. */
export const WORKSPACE_TIME_ZONE = 'Africa/Lagos';

export function today(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: WORKSPACE_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ledgerMessage(code: LedgerErrorCode): string {
  return t(`ledger.error.${code}`, { amount: '' });
}

/** The money account a person used last, for A-01's prefilled account. */
export function lastUsedAccount(snapshot: Snapshot): string | null {
  const live = new Set(snapshot.accounts.filter((a) => !a.archived).map((a) => a.id));
  for (const e of snapshot.events) {
    if (e.type === 'opening_balance' || e.type === 'reversal') continue;
    const line = e.lines.find((l) => live.has(l.ledgerAccountId));
    if (line) return line.ledgerAccountId;
  }
  return snapshot.accounts.find((a) => !a.archived)?.id ?? null;
}

export type Row = {
  event: TxEvent;
  /** Signed for the person: money in is positive, money out negative; transfers are the amount moved. */
  amount: bigint;
  title: string;
  category: string;
  account: string;
  waiting: boolean;
};

/** One row per transaction for lists (P11). Reversals and the events they undid are left out. */
export function rowsFor(snapshot: Snapshot): Row[] {
  const names = new Map<string, string>([
    ...snapshot.accounts.map((a) => [a.id, a.name] as const),
    ...snapshot.categories.map((c) => [c.id, c.name] as const),
  ]);
  const accountIds = new Set(snapshot.accounts.map((a) => a.id));
  const payees = new Map(snapshot.payees.map((p) => [p.id, p.name]));
  const rows: Row[] = [];
  for (const event of snapshot.events) {
    if (event.type === 'reversal' || event.status === 'reversed') continue;
    const money = event.lines.filter((l) => accountIds.has(l.ledgerAccountId));
    const other = event.lines.filter((l) => !accountIds.has(l.ledgerAccountId));
    if (event.type === 'transfer') {
      const to = money.find((l) => l.amountMinor > 0n);
      const from = money.find((l) => l.amountMinor < 0n);
      rows.push({
        event,
        amount: to?.amountMinor ?? 0n,
        title: t('tx.transferTitle', { from: names.get(from?.ledgerAccountId ?? '') ?? '', to: names.get(to?.ledgerAccountId ?? '') ?? '' }),
        category: t('add.kind.transfer'),
        account: '',
        waiting: snapshot.waiting.has(event.id),
      });
      continue;
    }
    const amount = money.reduce((s, l) => s + l.amountMinor, 0n);
    const category =
      event.type === 'opening_balance'
        ? t('tx.openingBalance')
        : other.length > 1
          ? t('tx.split')
          : (names.get(other[0]?.ledgerAccountId ?? '') ?? '');
    rows.push({
      event,
      amount,
      title: (event.payeeId && payees.get(event.payeeId)) || category,
      category,
      account: names.get(money[0]?.ledgerAccountId ?? '') ?? '',
      waiting: snapshot.waiting.has(event.id),
    });
  }
  return rows;
}
