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

async function seeded(opts?: { receivable?: boolean }) {
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

  if (opts?.receivable) {
    const opened = await repo.openPersonDebt({
      name: 'Lent to Tunde',
      direction: 'owedToMe',
      accountId,
      amount: 100_000_000n,
      date: '2026-06-01',
      interest: { kind: 'none' },
      dueDate: '2026-11-15',
    });
    const debtId = opened.ok ? opened.value.id : 'x';
    return { sync, repo, debtId };
  }

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
      scheduleInstallmentCount: 12,
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
  it('shows Left to pay, details, payments, trajectory chart, and milestone bar', async () => {
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

    // Visual elements
    expect(screen.getByTestId('debt-milestone-bar')).toBeTruthy();
    expect(screen.getByTestId('debt-trajectory-chart')).toBeTruthy();
    expect(screen.getByTestId('debt-priority-badge')).toBeTruthy();
  });

  it('switches between Timeline, Schedule, and Simulate tabs', async () => {
    const { sync, debtId } = await seeded();
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );

    // Switch to Schedule tab
    await fireEvent.press(screen.getByText(t('debts.redesign.tabSchedule')));
    expect(screen.getByTestId('debt-amortization-table')).toBeTruthy();

    // Switch to Simulate tab
    await fireEvent.press(screen.getByText(t('debts.redesign.tabSimulate')));
    expect(screen.getByTestId('debt-simulator-card')).toBeTruthy();

    // Trigger simulation chip
    await fireEvent.press(screen.getByTestId('debt-simulate-10'));
    expect(screen.getByTestId('debt-simulator-card')).toBeTruthy();
  });

  it('opens Record a payment sheet with principal/interest split and saves a payment', async () => {
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

  it('supports Send Reminder with WhatsApp deep link on owedToMe debt', async () => {
    const { sync, debtId } = await seeded({ receivable: true });
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );

    expect(screen.getByTestId('debt-send-reminder-btn')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('debt-send-reminder-btn'));

    expect(await screen.findByTestId('debt-reminder-sheet')).toBeTruthy();
    expect(screen.getByTestId('debt-reminder-whatsapp')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('debt-reminder-whatsapp'));
  });

  it('supports Write-off workflow on owedToMe debt', async () => {
    const { sync, repo, debtId } = await seeded({ receivable: true });
    setParams({ id: debtId });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtScreen />
      </WorkspaceProvider>,
      { sync },
    );

    // Open More menu
    await fireEvent.press(screen.getByTestId('debt-redesign-more'));
    expect(await screen.findByTestId('debt-redesign-write-off')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('debt-redesign-write-off'));

    // Write-off sheet
    expect(await screen.findByTestId('debt-write-off-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('debt-write-off-reason'), 'Uncollectable loan');
    await fireEvent.press(screen.getByTestId('debt-write-off-confirm'));

    await waitFor(async () => {
      const s = await repo.load();
      const updated = s.debts.find((d) => d.id === debtId);
      expect(updated?.status).toBe('written_off');
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
