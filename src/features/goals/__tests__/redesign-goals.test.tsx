import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { GoalsScreen } from '../GoalsScreen';

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
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'PiggyVest', type: 'savings', openingBalance: '50000000', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  if (!opts?.empty) {
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'PiggyVest')!;
    await repo.addGoal({
      name: 'Emergency fund',
      targetMinor: 100_000_000n,
      accountId: savings.id,
      targetDate: '2027-03-01',
      alreadySavedMinor: 72_000_000n,
    });
    await repo.addGoal({
      name: 'School fees',
      targetMinor: 50_000_000n,
      accountId: savings.id,
      targetDate: '2027-01-01',
      alreadySavedMinor: 46_000_000n,
    });
  }
  return { sync, repo };
}

describe('Page 14 redesign Goals (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows Figma empty state when there are no goals', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('redesign-goals')).toBeTruthy();
    expect(screen.getByTestId('goals-redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('goals.redesign.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('goals.redesign.emptyBody'))).toBeTruthy();
  });

  it('shows saved total and goal rows', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('goals-redesign-total')).toBeTruthy();
    expect(screen.getByText(t('goals.redesign.savedForGoals'))).toBeTruthy();
    expect(screen.getByText('Emergency fund')).toBeTruthy();
    expect(screen.getByText('School fees')).toBeTruthy();
  });

  it('opens New goal sheet and creates a goal', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('goals-redesign-add'));
    await setParams({ goal: 'new' });
    expect(await screen.findByTestId('goals-redesign-add-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('goals-redesign-name'), 'Holiday');
    await fireEvent.changeText(screen.getByTestId('goals-redesign-target'), '600000');
    await fireEvent.press(screen.getByTestId('goals-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.goals.some((g) => g.name === 'Holiday')).toBe(true);
    });
  });

  it('opens goal detail with Add money / Take money out', async () => {
    const { sync, repo } = await seeded();
    const goal = (await repo.load()).goals.find((g) => g.name === 'Emergency fund')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`goals-row-${goal.id}`));
    await setParams({ goal: goal.id });
    expect(await screen.findByTestId('goals-redesign-detail')).toBeTruthy();
    expect(screen.getByText(t('goals.redesign.addMoney'))).toBeTruthy();
    expect(screen.getByText(t('goals.redesign.takeMoneyOut'))).toBeTruthy();
  });

  it('Back navigates to More', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('redesign-back'));
    expect(router.push).toHaveBeenCalledWith('/more');
  });
});
