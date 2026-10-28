import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { GoalsScreen } from '../GoalsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'Savings', type: 'savings', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  return { sync, repo };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Goals page (F2.3)', () => {
  it('P14-02: requires an account when creating a goal', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('goals-add'));
    await fireEvent.changeText(screen.getByTestId('goal-name'), 'Emergency fund');
    await fireEvent.changeText(screen.getByTestId('goal-target'), '1000000');
    expect(screen.getByTestId('goal-save')).toBeDisabled();
    await fireEvent.press(screen.getByTestId('goal-account'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Savings' }));
    await waitFor(() => expect(screen.getByTestId('goal-save')).not.toBeDisabled());
  });

  it('P14-03: add money creates an allocation', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    await repo.addGoal({ name: 'Rent', targetMinor: 500_000_000n, accountId: savings.id, targetDate: '2027-06-01' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`goal-allocate-${(await repo.load()).goals[0]!.id}`));
    await fireEvent.changeText(screen.getByTestId('goal-allocate-amount'), '50000');
    await fireEvent.press(screen.getByTestId('goal-allocate-save'));
    await waitFor(async () => {
      expect((await repo.load()).allocations).toHaveLength(1);
    });
  });

  it('P14-06: completing target marks goal done', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Small', targetMinor: 10_000n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    await repo.allocateToGoal(created.value.id, { amount: 10_000n, date: '2026-10-28' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('goals-toggle'));
    expect(await screen.findByText(t('goals.done'))).toBeTruthy();
  });
});
