import { useMemo } from 'react';
import { useWorkspace } from './WorkspaceProvider';
import { useSyncStatus } from '../sync/SyncProvider';
import type {
  Account,
  Category,
  Goal,
  PersonDebt,
  Recurring,
  IncomeStream,
  Payee,
  TransactionRule,
  AppNotification,
  Holding,
} from './model';
import type { TxEvent } from './repository';
import { ledgerBalance, monthOf } from '@/ledger';

export function useDatabaseData() {
  const { repo, snapshot } = useWorkspace();
  const syncStatus = useSyncStatus();

  const isReady = Boolean(snapshot);

  const accounts: Account[] = useMemo(() => snapshot?.accounts || [], [snapshot?.accounts]);
  const categories: Category[] = useMemo(() => snapshot?.categories || [], [snapshot?.categories]);
  const events: TxEvent[] = useMemo(() => snapshot?.events || [], [snapshot?.events]);
  const assigns = useMemo(() => snapshot?.assigns || new Map<string, bigint>(), [snapshot?.assigns]);
  const goals: Goal[] = useMemo(() => snapshot?.goals || [], [snapshot?.goals]);
  const debts: PersonDebt[] = useMemo(() => snapshot?.debts || [], [snapshot?.debts]);
  const recurring: Recurring[] = useMemo(() => snapshot?.recurring || [], [snapshot?.recurring]);
  const incomeStreams: IncomeStream[] = useMemo(
    () => snapshot?.incomeStreams || [],
    [snapshot?.incomeStreams]
  );
  const rules: TransactionRule[] = useMemo(() => snapshot?.rules || [], [snapshot?.rules]);
  const notifications: AppNotification[] = useMemo(
    () => snapshot?.notifications || [],
    [snapshot?.notifications]
  );
  const payees: Payee[] = useMemo(() => snapshot?.payees || [], [snapshot?.payees]);
  const holdings: Holding[] = useMemo(() => snapshot?.holdings || [], [snapshot?.holdings]);

  // Account balances map: accountId -> balanceMinor
  const accountBalances = useMemo(() => {
    const map = new Map<string, bigint>();
    if (!snapshot) return map;
    for (const acc of snapshot.accounts) {
      const bal = ledgerBalance(acc.id, snapshot.events);
      map.set(acc.id, bal);
    }
    return map;
  }, [snapshot]);

  // Net worth: sum of all asset accounts minus liability accounts
  const netWorthMinor = useMemo(() => {
    if (!snapshot) return 0n;
    let sum = 0n;
    for (const acc of snapshot.accounts) {
      if (acc.archived) continue;
      const bal = ledgerBalance(acc.id, snapshot.events);
      sum += bal;
    }
    return sum;
  }, [snapshot]);

  // Monthly income and expense metrics
  const getMonthlyTotals = (targetMonth: string) => {
    let income = 0n;
    let spent = 0n;
    if (!snapshot) return { income, spent };

    for (const ev of snapshot.events) {
      if (ev.status !== 'posted') continue;
      if (monthOf(ev.date) === targetMonth) {
        let evAmount = 0n;
        for (const line of ev.lines) {
          if (line.amountMinor > 0n) evAmount += line.amountMinor;
        }
        if (ev.type === 'income') income += evAmount;
        else if (ev.type === 'expense') spent += evAmount;
      }
    }
    return { income, spent };
  };

  return {
    isReady,
    repo,
    snapshot,
    syncStatus,
    accounts,
    categories,
    events,
    assigns,
    goals,
    debts,
    recurring,
    incomeStreams,
    rules,
    notifications,
    payees,
    holdings,
    accountBalances,
    netWorthMinor,
    getMonthlyTotals,
  };
}
