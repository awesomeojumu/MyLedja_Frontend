import { WorkspaceRepository } from '@/data/workspace/repository';

import { memorySync } from '../../../../test/helpers/render';
import { calculateCashFlowForecast } from '../forecast';

async function buildWorkspace() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-test');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'Main Bank', type: 'bank', openingBalance: '50000000', openingDate: '2026-10-01' }, // ₦500,000
    ],
    categories: [
      { key: 'cat.groceries', group: 'group.food', name: 'Groceries' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });

  const snap = await repo.load();
  const bank = snap.accounts[0]!;
  const groceries = snap.categories[0]!;

  // Trailing expense (e.g. ₦60,000 in past 30 days => ₦2,000/day)
  await repo.addTransaction({
    kind: 'expense',
    accountId: bank.id,
    parts: [{ categoryId: groceries.id, amount: 60_000_00n }],
    date: '2026-10-15',
    payeeName: 'Supermarket',
  });

  // Recurring bill (e.g. ₦50,000 due around day 5)
  await repo.addRecurring({
    name: 'Internet Fiber',
    kind: 'bill',
    amountMinor: '5000000',
    accountId: bank.id,
    categoryId: groceries.id,
    rule: { every: 'month', on: 5 },
    startDate: '2026-10-01',
    cancelled: false,
  });

  // Recurring salary (e.g. ₦300,000 due around day 25, starting November)
  await repo.addRecurring({
    name: 'Tech Salary',
    kind: 'income',
    amountMinor: '30000000',
    accountId: bank.id,
    rule: { every: 'month', on: 25 },
    startDate: '2026-11-01',
    cancelled: false,
  });

  // Active debt with monthly payment of ₦30,000
  const debtRes = await repo.openPersonDebt({
    name: 'Gadget Loan',
    direction: 'iOwe',
    accountId: bank.id,
    amount: 200_000_00n,
    date: '2026-10-01',
  });
  if (debtRes.ok) {
    await repo.updatePersonDebt({
      ...debtRes.value,
      scheduleAmountMinor: '3000000',
      scheduleEvery: 'month',
    });
  }

  const updatedSnap = await repo.load();
  return { repo, snapshot: updatedSnap };
}

describe('Cash Flow Forecasting Engine', () => {
  it('projects 30-day forecast with recurring bills, salary, and debt payments', async () => {
    const { snapshot } = await buildWorkspace();
    const today = '2026-10-28';
    const forecast = calculateCashFlowForecast(snapshot, today, 30);

    expect(forecast.horizonDays).toBe(30);
    expect(forecast.currentLiquid).toBe(640_000_00n); // ₦500k opening - ₦60k spent + ₦200k loan inflow
    expect(forecast.dailyRunRate).toBe(2_000_00n); // ₦60,000 / 30
    expect(forecast.totalProjectedInflow).toBe(300_000_00n); // Salary on 2026-11-25
    expect(forecast.totalProjectedOutflow).toBeGreaterThan(50_000_00n); // Bills + Debt + Run rate
    expect(forecast.days.length).toBe(30);
    expect(forecast.hasDangerDip).toBe(false); // Balance stays well above ₦100,000
  });

  it('detects Danger Dip when simulated expense breaches safety floor', async () => {
    const { snapshot } = await buildWorkspace();
    const today = '2026-10-28';

    // Simulate huge unexpected expense of ₦600,000
    const forecast = calculateCashFlowForecast(snapshot, today, 30, {
      expenseMinor: 600_000_00n,
    });

    expect(forecast.hasDangerDip).toBe(true);
    expect(forecast.minBalance).toBeLessThan(100_000_00n);
    expect(forecast.bufferDays).toBeLessThan(30);
  });

  it('evaluates payday delay impact on cash flow buffer', async () => {
    const { snapshot } = await buildWorkspace();
    const today = '2026-10-28';

    // Delay salary by 14 days
    const delayedForecast = calculateCashFlowForecast(snapshot, today, 30, {
      paydayDelayDays: 14,
    });

    // On standard forecast, salary lands on 2026-11-25 (day 28)
    // Delayed by 14 days shifts it past 30 days
    expect(delayedForecast.totalProjectedInflow).toBe(0n);
  });
});
