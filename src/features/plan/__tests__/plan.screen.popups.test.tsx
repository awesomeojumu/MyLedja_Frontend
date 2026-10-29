import { act, fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { PlanScreen } from '../PlanScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const snap = await repo.load();
  await repo.addRecurring({
    kind: 'bill',
    name: 'Rent',
    amountMinor: '25000000',
    accountId: snap.accounts[0]!.id,
    categoryId: snap.categories.find((c) => c.kind === 'expense')!.id,
    rule: { every: 'month', on: 1 },
    startDate: '2026-10-01',
    reminderDays: 1,
    hideAmountOnLock: true,
  });
  return { sync, repo };
}

beforeEach(() => {
  resetParams();
  router.setParams.mockClear();
  router.push.mockClear();
});

describe('Plan popups deep links (PU00-5 / TB-04 / PU-25…28 / PU-59)', () => {
  it('TB04: ?tab=all and ?view=calendar', async () => {
    const { sync } = await seeded();
    setParams({ tab: 'all' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-all-schedules')).toBeTruthy();
    expect(screen.queryByTestId('plan-month-nav')).toBeNull();
  });

  it('PU25: ?schedule=new opens recurring sheet', async () => {
    const { sync } = await seeded();
    setParams({ schedule: 'new', kind: 'bill' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-recurring-sheet')).toBeTruthy();
    expect(screen.getByTestId('plan-recurring-save')).toBeDisabled();
  });

  it('PU27: ?find=1 opens find recurring', async () => {
    const { sync } = await seeded();
    setParams({ find: '1' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-find-sheet')).toBeTruthy();
  });

  it('PU28: upcoming length persists via settings', async () => {
    const { sync, repo } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('plan-upcoming'));
    await fireEvent.press(screen.getByText(t('plan.upcomingDays', { days: 14 })));
    const s = await repo.load();
    expect(s.settings.dueSoonDays).toBe(14);
  });

  it('PU59: ?day= opens day list with weekday title', async () => {
    const { sync } = await seeded();
    setParams({ day: '2026-10-01' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-day-sheet')).toBeTruthy();
  });

  it('PU26: mark paid opens via ?occurrence=', async () => {
    const { sync, repo } = await seeded();
    const bill = (await repo.load()).recurring[0]!;
    setParams({ occurrence: `${bill.id}:2026-10-01` });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-match-sheet')).toBeTruthy();
  });

  it('PU26-2: already paid sheet refuses second mark', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const bill = s.recurring[0]!;
    await repo.markBillPaid(bill.id, '2026-10-01', {
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.kind === 'expense')!.id,
      amount: 25000000n,
      date: '2026-10-01',
    });
    setParams({ occurrence: `${bill.id}:2026-10-01` });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-already-paid')).toBeTruthy();
    expect(screen.getByTestId('plan-match-undo')).toBeTruthy();
  });

  it('TB04: List/Calendar toggle writes ?view=', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByText(t('plan.viewCalendar')));
    expect(router.setParams).toHaveBeenCalledWith({ view: 'calendar' });
  });

  it('PU00-3: Add bill primary disabled until valid', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('plan-add-menu'));
    await fireEvent.press(screen.getByTestId('plan-add-bill'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ schedule: 'new' }));
    await act(async () => setParams({ schedule: 'new', kind: 'bill' }));
    expect(screen.getByTestId('plan-recurring-save')).toBeDisabled();
  });
});
