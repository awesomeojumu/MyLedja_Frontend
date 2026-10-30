import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { DebtScreen } from '../DebtScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance: '500000000', openingDate: '2026-01-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const accountId = (await repo.load()).accounts[0]!.id;
  const opened = await repo.openPersonDebt({
    name: 'Car loan',
    direction: 'iOwe',
    accountId,
    amount: 120_000_000n,
    date: '2025-01-15',
    interest: { kind: 'percent_month', percent: 1.5 },
    dueDate: '2026-11-15',
  });
  const debtId = opened.ok ? opened.value.id : 'x';
  if (opened.ok) {
    await repo.updatePersonDebt({
      ...opened.value,
      scheduleAmountMinor: '4500000',
      scheduleEvery: 'month',
      scheduleFirstDue: '2026-11-15',
      notes: 'loan',
    });
    await repo.recordDebtPayment(debtId, {
      accountId,
      amount: 4_500_000n,
      date: '2026-09-15',
    });
    await repo.recordDebtPayment(debtId, {
      accountId,
      amount: 4_500_000n,
      date: '2026-10-15',
    });
  }
  return { sync, repo, debtId };
}

describe('Page 16 redesign Debt (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows Left to pay, details, payments, and Record a payment', async () => {
    const { sync, debtId } = await seeded();
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('redesign-debt')).toBeTruthy();
    expect(screen.getByText(t('debts.redesign.leftToPay'))).toBeTruthy();
    expect(screen.getByTestId('debt-redesign-details')).toBeTruthy();
    expect(screen.getByText(t('debts.redesign.payments'))).toBeTruthy();
    expect(screen.getByTestId('debt-redesign-record')).toBeTruthy();
  });

  it('opens Record a payment sheet and saves a payment', async () => {
    const { sync, repo, debtId } = await seeded();
    const before = (await repo.load()).debtEntries.filter((e) => e.debtId === debtId && e.kind === 'payment').length;
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debt-redesign-record'));
    expect(await screen.findByTestId('debt-redesign-pay-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('debt-redesign-pay-amount'), '45000');
    await fireEvent.press(screen.getByTestId('debt-redesign-pay-save'));
    await waitFor(async () => {
      const after = (await repo.load()).debtEntries.filter((e) => e.debtId === debtId && e.kind === 'payment').length;
      expect(after).toBe(before + 1);
    });
  });

  it('Back navigates to Debts list', async () => {
    const { sync, debtId } = await seeded();
    const { router } = require('../../../../test/helpers/router') as { router: { push: jest.Mock } };
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('redesign-back'));
    expect(router.push).toHaveBeenCalledWith('/debts');
  });
});
