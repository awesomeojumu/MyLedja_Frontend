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

async function seeded(opts?: { empty?: boolean }) {
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

  it('shows You owe total, pay-off order chips, and debt rows', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('debts-redesign-total')).toBeTruthy();
    expect(screen.getByText(t('debts.redesign.youOwe'))).toBeTruthy();
    expect(screen.getByTestId('debts-order-smallest')).toBeTruthy();
    expect(screen.getByText('Car loan')).toBeTruthy();
    expect(screen.getByText('Loan from Tunde')).toBeTruthy();
  });

  it('opens Add a debt sheet and creates an iOwe debt', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <DebtsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('debts-redesign-add'));
    expect(await screen.findByTestId('debts-redesign-add-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('debts-redesign-name'), 'Credit card');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-amount'), '250000');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-interest'), '28');
    await fireEvent.changeText(screen.getByTestId('debts-redesign-monthly'), '25000');
    await fireEvent.press(screen.getByTestId('debts-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.debts.some((d) => d.name === 'Credit card' && d.direction === 'iOwe')).toBe(true);
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
