import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { IncomeScreen } from '../IncomeScreen';

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
  await repo.addIncomeStream({
    name: 'Salary',
    kind: 'regular',
    expectedMinor: '64000000',
    accountId: (await repo.load()).accounts[0]!.id,
    categoryId: (await repo.load()).categories.find((c) => c.kind === 'income')!.id,
    rule: { every: 'month', on: 27 },
    countInBudget: true,
    taxClass: 'PAYE',
  });
  return { sync, repo };
}

describe('Income page (F2.2)', () => {
  it('P13-01: shows summary tiles and add stream', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByText(t('income.title'))).toBeTruthy();
    expect(screen.getByTestId('income-add')).toBeTruthy();
    expect(screen.getByTestId('income-summary')).toBeTruthy();
    expect(screen.getAllByText('Salary').length).toBeGreaterThan(0);
  });

  it('P13-08: opens deep add stream form with routing section', async () => {
    const { sync } = await seeded();
    setParams({ stream: 'new' });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-add-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByText(new RegExp(t('income.sectionRouting'))));
    await fireEvent.press(screen.getByText(new RegExp(t('income.sectionRecord'))));
    expect(screen.getByTestId('income-routing')).toBeTruthy();
    expect(screen.getByTestId('income-record-mode')).toBeTruthy();
  });

  it('P13-07: shows 12-month chart when streams exist', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-chart')).toBeTruthy();
  });

  it('P13-26: mark received opens match picker', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const stream = snap.incomeStreams[0]!;
    await repo.addTransaction({
      kind: 'income',
      accountId: snap.accounts[0]!.id,
      categoryId: snap.categories.find((c) => c.kind === 'income')!.id,
      amount: 32_000_000n,
      date: '2026-10-15',
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId(`income-record-${stream.id}`));
    expect(screen.getByText(t('income.matchPickTitle'))).toBeTruthy();
    expect(screen.getByTestId('income-match-create')).toBeTruthy();
  });

  it('PU-26: ?occurrence= opens mark received sheet', async () => {
    const { sync, repo } = await seeded();
    const stream = (await repo.load()).incomeStreams[0]!;
    setParams({ occurrence: stream.id });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('income-record-sheet')).toBeTruthy();
  });
});

describe('E24 priorSameMonth gate (P0)', () => {
  it('does not post salary_gross after a same-month partial', async () => {
    const { repo } = await seeded();
    const snap = await repo.load();
    const stream = snap.incomeStreams[0]!;
    const pension = await repo.addAccount({
      name: 'Pension',
      type: 'savings',
      openingBalance: 0n,
      openingDate: '2026-10-01',
    });
    const nhf = await repo.addAccount({
      name: 'NHF',
      type: 'savings',
      openingBalance: 0n,
      openingDate: '2026-10-01',
    });
    if (!pension.ok || !nhf.ok) throw new Error('accounts');
    await repo.updateIncomeStream({
      ...stream,
      recordMode: 'gross',
      grossMinor: '80000000',
      expectedMinor: '62000000',
      deductions: [
        { kind: 'paye', amountMinor: '9600000' },
        { kind: 'pension', amountMinor: '6400000', targetAccountId: pension.value.id },
        { kind: 'nhf', amountMinor: '2000000', targetAccountId: nhf.value.id },
      ],
    });
    const partial = await repo.recordIncomeReceived(stream.id, {
      accountId: snap.accounts[0]!.id,
      amount: 30_000_000n,
      date: '2026-10-10',
    });
    expect(partial.ok && partial.value.type).toBe('income');
    const topUp = await repo.recordIncomeReceived(stream.id, {
      accountId: snap.accounts[0]!.id,
      amount: 62_000_000n,
      date: '2026-10-27',
    });
    expect(topUp.ok && topUp.value.type).toBe('income');
    const events = (await repo.load()).events.filter((e) => e.incomeStreamId === stream.id);
    expect(events.some((e) => e.type === 'salary_gross')).toBe(false);
  });
});
