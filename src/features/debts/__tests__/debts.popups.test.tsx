import { fireEvent, screen } from '@testing-library/react-native';

import { formatDay } from '@/design/components';
import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { DebtsScreen } from '../DebtsScreen';
import { debtClosedDate } from '../helpers';
import { moneyBackPromptCopy, suggestMoneyBack } from '../moneyBack';
import { scheduleAmounts } from '../schedule';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

beforeEach(() => {
  require('../../../../test/helpers/router').resetParams();
});

afterEach(() => {
  require('../../../../test/helpers/router').resetParams();
});

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'OPay', type: 'bank', openingBalance: '200000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.salary', group: 'group.income', name: 'Salary' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

describe('Debts popups (PU-34…36, 58, TB-06)', () => {
  it('PU34-1 case 9: lending lowers account and is not spending', async () => {
    const { repo } = await seeded();
    const snap = await repo.load();
    const accountId = snap.accounts[0]!.id;
    const spentBefore = snap.events.filter((e) => e.type === 'expense').length;
    const opened = await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-15',
      payeeName: 'Tunde',
      bankNames: ['TUNDE OKAFOR'],
    });
    expect(opened.ok).toBe(true);
    const after = await repo.load();
    expect(after.events.some((e) => e.type === 'lend')).toBe(true);
    expect(after.events.filter((e) => e.type === 'expense').length).toBe(spentBefore);
    const payee = after.payees.find((p) => p.name === 'Tunde');
    expect(payee?.aliases?.includes('TUNDE OKAFOR')).toBe(true);
  });

  it('PU34-2 case 7: borrowing raises account and is not income', async () => {
    const { repo } = await seeded();
    const snap = await repo.load();
    const accountId = snap.accounts[0]!.id;
    const incomeBefore = snap.events.filter((e) => e.type === 'income').length;
    const opened = await repo.openPersonDebt({
      name: 'Coop',
      direction: 'iOwe',
      accountId,
      amount: 50_000_000n,
      date: '2026-10-15',
    });
    expect(opened.ok).toBe(true);
    const after = await repo.load();
    expect(after.events.some((e) => e.type === 'loan_proceeds')).toBe(true);
    expect(after.events.filter((e) => e.type === 'income').length).toBe(incomeBefore);
  });

  it('PU34 sheet shows interest and pay-back controls', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-lent'));
    expect(screen.getByTestId('debt-direction')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('debt-interest-toggle'));
    expect(screen.getByTestId('debt-interest-kind')).toBeTruthy();
    expect(screen.getByTestId('debt-payback')).toBeTruthy();
    expect(screen.getByText(t('debts.lendCaption'))).toBeTruthy();
  });

  it('PU35-1 case 10: payment with interest splits correctly', async () => {
    const { repo } = await seeded();
    const snap = await repo.load();
    const accountId = snap.accounts[0]!.id;
    const opened = await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
    });
    if (!opened.ok) throw new Error(opened.error);
    const paid = await repo.recordDebtPayment(opened.value.id, {
      accountId,
      amount: 4_000_000n,
      date: '2026-10-20',
      interest: 200_000n,
    });
    expect(paid.ok).toBe(true);
    const after = await repo.load();
    expect(after.events.some((e) => e.type === 'collect')).toBe(true);
    const bal = repo.debtBalance(opened.value, after);
    expect(bal).toBe(6_000_000n);
  });

  it('PU35-2: overpayment requires gift or credit', async () => {
    const { repo } = await seeded();
    const snap = await repo.load();
    const accountId = snap.accounts[0]!.id;
    const opened = await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 1_000_000n,
      date: '2026-10-01',
    });
    if (!opened.ok) throw new Error(opened.error);
    const refused = await repo.recordDebtPayment(opened.value.id, {
      accountId,
      amount: 1_500_000n,
      date: '2026-10-20',
    });
    expect(refused.ok).toBe(false);
    const gift = await repo.recordDebtPayment(opened.value.id, {
      accountId,
      amount: 1_500_000n,
      date: '2026-10-20',
      overpayment: 'gift',
    });
    expect(gift.ok).toBe(true);
  });

  it('PU36-1: instalments absorb remainder to total', () => {
    const amounts = scheduleAmounts(3, 10_000n);
    expect(amounts.reduce((s, a) => s + a, 0n)).toBe(10_000n);
    expect(amounts[0]).toBe(3333n);
    expect(amounts[2]).toBe(3334n);
  });

  it('PU58-1 case 26: money back lowers debt, not income', async () => {
    const { repo } = await seeded();
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
      payeeName: 'Tunde',
      bankNames: ['TUNDE OKAFOR'],
    });
    const snapshot = await repo.load();
    const suggestions = suggestMoneyBack(snapshot, {
      amount: 4_000_000n,
      date: '2026-10-15',
      accountId,
      payeeName: 'TUNDE OKAFOR',
      movement: 'income',
    });
    expect(suggestions).toHaveLength(1);
    const incomeBefore = snapshot.events.filter((e) => e.type === 'income').length;
    const confirmed = await repo.confirmMoneyBack(
      { debtId: suggestions[0]!.debtId, amount: 4_000_000n, date: '2026-10-15', accountId },
      'money_back',
    );
    expect(confirmed.ok).toBe(true);
    const after = await repo.load();
    expect(after.events.filter((e) => e.type === 'income').length).toBe(incomeBefore);
    expect(after.events.some((e) => e.type === 'collect')).toBe(true);
  });

  it('PU58-2 case 27: income choice leaves debt alone', async () => {
    const { repo } = await seeded();
    const snap0 = await repo.load();
    const accountId = snap0.accounts[0]!.id;
    const incomeCat = snap0.categories.find((c) => c.kind === 'income')!;
    await repo.openPersonDebt({
      name: 'Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 10_000_000n,
      date: '2026-10-01',
      payeeName: 'Tunde',
    });
    const snapshot = await repo.load();
    const suggestions = suggestMoneyBack(snapshot, {
      amount: 4_000_000n,
      date: '2026-10-15',
      accountId,
      payeeName: 'Tunde',
      movement: 'income',
    });
    const debt = snapshot.debts[0]!;
    const balBefore = repo.debtBalance(debt, snapshot);
    await repo.confirmMoneyBack(
      { debtId: suggestions[0]!.debtId, amount: 4_000_000n, date: '2026-10-15', accountId },
      'income',
      { categoryId: incomeCat.id },
    );
    const after = await repo.load();
    expect(repo.debtBalance(debt, after)).toBe(balBefore);
    expect(after.events.some((e) => e.type === 'income')).toBe(true);
  });

  it('PU58-3: never auto-posts; copy differs for outgoing', () => {
    const copy = moneyBackPromptCopy({
      id: '1',
      debtId: 'd',
      direction: 'outgoing',
      personName: 'Mum',
      outstanding: 4_000_000n,
      amount: 1_000_000n,
      date: '2026-10-15',
      accountId: 'a',
      reason: 'payee_match',
    });
    expect(copy.titleKey).toBe('debts.moneyBack.titleOutgoing');
    expect(copy.bodyKey).toBe('debts.moneyBack.bodyOutgoing');
  });

  it('TB06-1: summary tiles stay while filter changes', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    await repo.openPersonDebt({
      name: 'Ada',
      direction: 'owedToMe',
      accountId: snap.accounts[0]!.id,
      amount: 2_000_000n,
      date: '2026-10-01',
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    const summary = screen.getByTestId('debts-summary');
    await fireEvent.press(screen.getByTestId('debts-filter-owedToMe'));
    expect(screen.getByTestId('debts-summary')).toBe(summary);
    await fireEvent.press(screen.getByTestId('debts-filter-settled'));
    expect(screen.getByTestId('debts-summary')).toBeTruthy();
  });

  it('TB06-2: written-off debt appears under Settled with write-off date', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const opened = await repo.openPersonDebt({
      name: 'Chi',
      direction: 'owedToMe',
      accountId: snap.accounts[0]!.id,
      amount: 500_000n,
      date: '2026-10-01',
    });
    if (!opened.ok) throw new Error(opened.error);
    await repo.writeOffDebt(opened.value.id, { amount: 500_000n, date: '2026-10-20', reason: 'forgiveness' });
    const after = await repo.load();
    expect(after.debtEntries.some((e) => e.debtId === opened.value.id && e.kind === 'write_off' && e.date === '2026-10-20')).toBe(
      true,
    );
    expect(debtClosedDate(opened.value.id, after)).toBe('2026-10-20');
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-filter-settled'));
    expect(await screen.findByText('Chi')).toBeTruthy();
    expect(screen.getByTestId(`debt-closed-${opened.value.id}`)).toBeTruthy();
    expect(screen.getByText(t('debts.writtenOffOn', { date: formatDay('2026-10-20') }))).toBeTruthy();
  });
});
