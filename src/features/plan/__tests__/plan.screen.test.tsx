import { screen, fireEvent } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams } from '../../../../test/helpers/router';
import { PlanScreen } from '../PlanScreen';
import { planSummaryStrip, billsForMonth } from '../recurrence';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

beforeEach(() => {
  resetParams();
});

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
  await repo.addRecurring({
    kind: 'bill',
    name: 'Rent',
    amountMinor: '25000000',
    accountId: (await repo.load()).accounts[0]!.id,
    categoryId: (await repo.load()).categories.find((c) => c.kind === 'expense')!.id,
    rule: { every: 'month', on: 1 },
    startDate: '2026-10-01',
  });
  return { sync, repo };
}

describe('Plan page (DESIGN.md page 12)', () => {
  it('P12-01: four-column summary strip', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const rows = billsForMonth(s, '2026-10', '2026-10-28', 7);
    const strip = planSummaryStrip(s, '2026-10', rows);
    expect(strip.goingOut).toBeGreaterThan(0n);

    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-summary-strip')).toBeTruthy();
    expect(screen.getByTestId('plan-coming-in')).toBeTruthy();
    expect(screen.getByTestId('plan-going-out')).toBeTruthy();
    expect(screen.getByTestId('plan-left-after')).toBeTruthy();
    expect(screen.getByTestId('plan-missed')).toBeTruthy();
  });

  it('P12-05: list and calendar toggle', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByText(t('plan.viewCalendar')));
    expect(screen.getByTestId('plan-calendar')).toBeTruthy();
  });

  it('P12-06: All schedules tab (DESIGN page 12)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByText(t('plan.tabAllSchedules')));
    expect(screen.getByTestId('plan-all-schedules')).toBeTruthy();
    expect(screen.getAllByText('Rent').length).toBeGreaterThan(0);
  });

  it('P12-07: mark paid opens match sheet (#26)', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const bill = s.recurring[0]!;
    await repo.addTransaction({
      kind: 'expense',
      accountId: s.accounts[0]!.id,
      parts: [{ categoryId: s.categories.find((c) => c.kind === 'expense')!.id, amount: 250_000_00n }],
      date: '2026-10-01',
      payeeName: 'Rent',
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`bill-mark-${bill.id}`));
    const { setParams } = require('../../../../test/helpers/router');
    await setParams({ occurrence: `${bill.id}:2026-10-01` });
    expect(screen.getByTestId('plan-match-sheet')).toBeTruthy();
  });

  it('P12-09: month navigation', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('plan-month-nav')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('plan-prev-month'));
  });

  it('P12-08: add recurring sheet (#25)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PlanScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('plan-add-menu'));
    await fireEvent.press(screen.getByTestId('plan-add-bill'));
    // Opens via ?schedule=new (PU00-5).
    const { setParams } = require('../../../../test/helpers/router');
    await setParams({ schedule: 'new', kind: 'bill' });
    expect(screen.getByTestId('plan-recurring-sheet')).toBeTruthy();
  });
});
