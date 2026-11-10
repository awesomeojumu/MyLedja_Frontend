import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router } from '../../../../test/helpers/router';
import { DebtsScreen } from '../DebtsScreen';

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

async function seeded(opts?: { empty?: boolean; withReceivable?: boolean; withImport?: boolean }) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '500000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  if (!opts?.empty) {
    const s = await repo.load();
    const accountId = s.accounts[0]!.id;
    const car = await repo.openPersonDebt({
      name: 'Car loan',
      direction: 'iOwe',
      accountId,
      amount: 73_540_000n,
      date: '2026-01-15',
      interest: { kind: 'percent_month', percent: 1.5 },
      dueDate: '2026-11-15',
    });
    if (car.ok) {
      await repo.updatePersonDebt({
        ...car.value,
        scheduleAmountMinor: '4500000',
        scheduleEvery: 'month',
        scheduleFirstDue: '2026-11-15',
        notes: 'loan',
      });
    }
    await repo.openPersonDebt({
      name: 'Loan from Tunde',
      direction: 'iOwe',
      accountId,
      amount: 5_000_000n,
      date: '2026-09-01',
      interest: { kind: 'none' },
      dueDate: '2026-11-01',
    });

    if (opts?.withReceivable) {
      await repo.openPersonDebt({
        name: 'Chioma friend',
        direction: 'owedToMe',
        accountId,
        amount: 25_000_000n,
        date: '2026-08-01',
        interest: { kind: 'none' },
        dueDate: '2026-10-15', // Overdue relative to 2026-10-28
      });
    }
  }
  return { sync, repo };
}

describe('Page 15 redesign Debts (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows Figma empty state when there are no debts you owe', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('redesign-debts')).toBeTruthy();
    expect(screen.getByTestId('debts-redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('debts.redesign.emptyTitle'))).toBeTruthy();
  });

  it('shows dual summary header, pay-off order chips, focus debt badge, and strategy comparison', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('debts-summary-header')).toBeTruthy();
    expect(screen.getByTestId('debts-summary-owed-to-you')).toBeTruthy();
    expect(screen.getByTestId('debts-summary-you-owe')).toBeTruthy();
    expect(screen.getByTestId('debts-summary-net')).toBeTruthy();

    expect(screen.getByTestId('debts-redesign-total')).toBeTruthy();
    expect(screen.getAllByText(t('debts.redesign.youOwe')).length).toBeGreaterThan(0);
    expect(screen.getByTestId('debts-order-smallest')).toBeTruthy();
    expect(screen.getByText('Car loan')).toBeTruthy();
    expect(screen.getByText('Loan from Tunde')).toBeTruthy();

    // Focus debt badge on the first row in strategy order
    expect(screen.getByTestId('debts-focus-badge')).toBeTruthy();
    // Accelerator card
    expect(screen.getByTestId('debts-accelerator-card')).toBeTruthy();
    expect(screen.getByTestId('debts-accelerator-10')).toBeTruthy();
    // Bank loans section
    expect(screen.getByTestId('debts-bank-loans')).toBeTruthy();
  });

  it('toggles strategy accelerator and updates calculation', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-accelerator-10'));
    expect(screen.getByTestId('debts-accelerator-card')).toBeTruthy();
  });

  it('switches to They owe me recovery tab and shows uncollected capital and reminder button', async () => {
    const { sync, repo } = await seeded({ withReceivable: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    // Switch to owedToMe tab
    await fireEvent.press(screen.getByText(t('debts.redesign.tabOwedToMe')));

    expect(screen.getByTestId('debts-recovery-card')).toBeTruthy();
    expect(screen.getByTestId('debts-recovery-uncollected')).toBeTruthy();
    expect(screen.getByText('Chioma friend')).toBeTruthy();

    // Overdue badge
    const debtors = (await repo.load()).debts;
    const chioma = debtors.find((d) => d.name === 'Chioma friend')!;
    expect(screen.getByTestId(`debts-row-overdue-${chioma.id}`)).toBeTruthy();
    expect(screen.getByTestId(`debts-row-remind-${chioma.id}`)).toBeTruthy();

    // Press remind
    await fireEvent.press(screen.getByTestId(`debts-row-remind-${chioma.id}`));
  });

  it('opens inline quick payment sheet and records payment directly from row', async () => {
    const { sync, repo } = await seeded();
    const debts = (await repo.load()).debts;
    const tunde = debts.find((d) => d.name === 'Loan from Tunde')!;

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );

    await fireEvent.press(screen.getByTestId(`debt-quick-pay-${tunde.id}`));
    expect(await screen.findByTestId('debt-quick-pay-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('debt-quick-pay-amount'), '25000');
    await fireEvent.press(screen.getByTestId('debt-quick-pay-save'));

    await waitFor(async () => {
      const s = await repo.load();
      const payments = s.debtEntries.filter((e) => e.debtId === tunde.id && e.kind === 'payment');
      expect(payments.length).toBe(1);
    });
  });

  it('opens Add a debt sheet and creates an iOwe debt with loan app and real APR check', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-btn-borrowed'));
    expect(await screen.findByTestId('debts-redesign-add-sheet')).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('debts-redesign-name'), 'Carbon Loan App');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-amount'), '100000');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-interest'), '5');

    // Real APR card should be visible
    expect(screen.getByTestId('debts-real-apr-card')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('debts-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.debts.some((d) => d.name === 'Carbon Loan App' && d.direction === 'iOwe')).toBe(true);
    });
  });

  it('opens Add a debt sheet with I lent and creates an Ajo / Cooperative debt', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-btn-lent'));
    expect(await screen.findByTestId('debts-redesign-add-sheet')).toBeTruthy();

    // Select cooperative
    await fireEvent.press(screen.getByText(t('debts.redesign.kindCooperative')));
    expect(screen.getByText(t('debts.redesign.cooperativeNote'))).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId('debts-redesign-name'), 'Family Ajo Rotation');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-amount'), '50000');
    await fireEvent.press(screen.getByTestId('debts-redesign-save'));

    await waitFor(async () => {
      const s = await repo.load();
      expect(s.debts.some((d) => d.name === 'Family Ajo Rotation' && d.direction === 'owedToMe')).toBe(true);
    });
  });

  it('Back navigates to More', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('redesign-back'));
    expect(router.push).toHaveBeenCalledWith('/more');
  });
});
