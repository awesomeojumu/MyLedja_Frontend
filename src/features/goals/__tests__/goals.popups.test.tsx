import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { GoalsScreen } from '../GoalsScreen';
import { monthlyNeeded, reachesByDate } from '../helpers';

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
      { name: 'Savings', type: 'savings', openingBalance: '50000000', openingDate: '2026-10-01' },
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
  require('../../../../test/helpers/router').resetParams();
});

afterEach(() => {
  jest.useRealTimers();
  require('../../../../test/helpers/router').resetParams();
});

describe('Goals popups (PU-30…33, TB-05)', () => {
  it('PU31-1: account is required (defaults to main savings)', async () => {
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
    // DESIGN: default the main savings account so Add is usable without an extra tap.
    expect(screen.getByTestId('goal-save')).not.toBeDisabled();
  });

  it('PU31-2: monthly needed updates with target/date', () => {
    const m1 = monthlyNeeded(0n, 1_000_000_00n, '2026-10-28', '2027-06-28');
    const m2 = monthlyNeeded(0n, 2_000_000_00n, '2026-10-28', '2027-06-28');
    expect(m2!).toBeGreaterThan(m1!);
  });

  it('PU33-1: reaches-by date updates with amount', () => {
    const slow = reachesByDate(0n, 1_000_000_00n, 10_000_00n, 'month', '2026-10-28');
    const fast = reachesByDate(0n, 1_000_000_00n, 50_000_00n, 'month', '2026-10-28');
    expect(fast!.localeCompare(slow!)).toBeLessThan(0);
  });

  it('PU30-1: deleting a goal leaves account money untouched', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Laptop', targetMinor: 100_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    await repo.allocateToGoal(created.value.id, { amount: 20_000_00n, date: '2026-10-28' });
    const eventsBefore = (await repo.load()).events.length;
    await repo.deleteGoal(created.value.id);
    const after = await repo.load();
    expect(after.goals.find((g) => g.id === created.value.id)).toBeUndefined();
    expect(after.events.length).toBe(eventsBefore);
  });

  it('PU30-2 / TB05-1: mark done moves to Completed tab', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Trip', targetMinor: 500_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    await repo.updateGoal({ ...created.value, status: 'completed', completedAt: '2026-10-28T12:00:00Z' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByText(t('goals.completed')));
    expect(await screen.findByText('Trip')).toBeTruthy();
    expect(screen.getByText(t('goals.done'))).toBeTruthy();
  });

  it('PU32: allocate preview shows before → after percent', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Rent', targetMinor: 100_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    const goalId = (await repo.load()).goals[0]!.id;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`goal-allocate-${goalId}`));
    await fireEvent.changeText(screen.getByTestId('goal-allocate-amount'), '25000');
    expect(screen.getByTestId('goal-allocate-preview')).toBeTruthy();
    expect(screen.getByText(/0% → 25%/)).toBeTruthy();
  });

  it('PU00-3: allocate save disabled until amount valid', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Fund', targetMinor: 10_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    const goalId = (await repo.load()).goals[0]!.id;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <GoalsScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`goal-allocate-${goalId}`));
    await fireEvent.changeText(screen.getByTestId('goal-allocate-amount'), '');
    expect(screen.getByTestId('goal-allocate-save')).toBeDisabled();
  });

  it('P14 reach: sets completedAt and creates a goals notification', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Done soon', targetMinor: 10_000n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    const r = await repo.allocateToGoal(created.value.id, { amount: 10_000n, date: '2026-10-28' });
    expect(r.ok && r.value.completed).toBe(true);
    const after = await repo.load();
    const goal = after.goals.find((g) => g.id === created.value.id)!;
    expect(goal.status).toBe('completed');
    expect(goal.completedAt).toBeTruthy();
    expect(after.notifications.some((n) => n.id === `goal-reached:${goal.id}` && n.category === 'goals')).toBe(true);
  });

  it('PU-33: setGoalSchedule stores schedule fields', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Sched', targetMinor: 100_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    await repo.setGoalSchedule({
      ...created.value,
      scheduleAmountMinor: '2500000',
      scheduleDayOfMonth: 28,
      scheduleEvery: 'month',
      scheduleStarts: '2026-10-28',
      scheduleAutoAllocate: true,
    });
    const after = await repo.load();
    const goal = after.goals.find((g) => g.id === created.value.id)!;
    expect(goal.scheduleAmountMinor).toBe('2500000');
    expect(goal.scheduleDayOfMonth).toBe(28);
    expect(goal.scheduleAutoAllocate).toBe(true);
  });

  it('PU-33 R4: auto-allocate day runner funds on schedule day', async () => {
    const { repo } = await seeded();
    const s = await repo.load();
    const savings = s.accounts.find((a) => a.name === 'Savings')!;
    const created = await repo.addGoal({ name: 'Auto', targetMinor: 100_000_00n, accountId: savings.id });
    if (!created.ok) throw new Error(created.error);
    await repo.setGoalSchedule({
      ...created.value,
      scheduleAmountMinor: '500000',
      scheduleDayOfMonth: 28,
      scheduleEvery: 'month',
      scheduleStarts: '2026-10-01',
      scheduleAutoAllocate: true,
    });
    const n = await repo.runGoalAutoAllocations('2026-10-28');
    expect(n).toBe(1);
    const after = await repo.load();
    expect(after.allocations.filter((a) => a.goalId === created.value.id)).toHaveLength(1);
    // Idempotent on the same day.
    expect(await repo.runGoalAutoAllocations('2026-10-28')).toBe(0);
  });
});
