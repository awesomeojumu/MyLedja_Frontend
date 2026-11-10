import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { IncomeScreen } from '../IncomeScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

async function seeded(opts?: { empty?: boolean; unmatched?: boolean }) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  if (!opts?.empty) {
    const snap = await repo.load();
    const sal = await repo.addIncomeStream({
      name: 'Salary',
      kind: 'regular',
      expectedMinor: '52000000',
      accountId: snap.accounts[0]!.id,
      categoryId: snap.categories.find((c) => c.kind === 'income')!.id,
      rule: { every: 'month', on: 28 },
      countInBudget: true,
      taxClass: 'PAYE',
    });
    await repo.addIncomeStream({
      name: 'Side business',
      kind: 'variable',
      expectedMinor: '8000000',
      accountId: snap.accounts[0]!.id,
      categoryId: snap.categories.find((c) => c.kind === 'income')!.id,
      rule: { every: 'month', on: 15 },
      countInBudget: true,
    });

    if (opts?.unmatched) {
      // Post an income event not linked to any stream
      const cat = snap.categories.find((c) => c.kind === 'income')!;
      await repo.addTransaction({
        kind: 'income',
        accountId: snap.accounts[0]!.id,
        categoryId: cat.id,
        amount: 2500000n,
        date: '2026-11-05',
      });
    }

    // Mark previous month paid to test dots and tax table
    await repo.recordIncomeReceived(sal.id, {
      accountId: snap.accounts[0]!.id,
      amount: 52000000n,
      date: '2026-10-28',
    });
  }
  return { sync, repo };
}

describe('Page 13 redesign Income (EXPO_PUBLIC_REDESIGN on)', () => {
  it('shows Figma empty state when there are no streams', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('redesign-income')).toBeTruthy();
    expect(screen.getByTestId('income-redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('income.redesign.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('income.redesign.emptyBody'))).toBeTruthy();
  });

  it('shows received summary, 6-month chart, and sources', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-redesign-summary')).toBeTruthy();
    expect(screen.getByTestId('income-redesign-history')).toBeTruthy();
    expect(screen.getByTestId('income-redesign-chart')).toBeTruthy();
    expect(screen.getByText(t('income.redesign.sources'))).toBeTruthy();
    expect(screen.getByText('Salary')).toBeTruthy();
    expect(screen.getByText('Side business')).toBeTruthy();
    expect(screen.getAllByText(t('income.redesign.varies')).length).toBeGreaterThanOrEqual(1);
  });

  it('navigates previous and next months', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-month-label')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('income-prev-month'));
    expect(screen.getByTestId('income-month-label')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('income-next-month'));
    expect(screen.getByTestId('income-month-label')).toBeTruthy();
  });

  it('renders stream grouping by kind and 6-dot payment reliability timeline', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const sal = snap.incomeStreams.find((s) => s.name === 'Salary')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-group-regular')).toBeTruthy();
    expect(screen.getByTestId('income-group-variable')).toBeTruthy();
    expect(screen.getByTestId(`income-dots-${sal.id}`)).toBeTruthy();
  });

  it('shows unmatched inflow inbox with mark one-off action', async () => {
    const { sync, repo } = await seeded({ unmatched: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-unmatched-inbox')).toBeTruthy();
    const snap = await repo.load();
    const unmatchedEv = snap.events.find((e) => e.type === 'income' && !e.incomeStreamId && !e.oneOff)!;
    expect(screen.getByTestId(`income-oneoff-${unmatchedEv.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`income-oneoff-${unmatchedEv.id}`));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.events.find((e) => e.id === unmatchedEv.id)?.oneOff).toBe(true);
    });
  });

  it('renders annual tax classification table', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId('income-tax-table')).toBeTruthy();
    expect(screen.getByText('PAYE')).toBeTruthy();
  });

  it('toggles View as table', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('income-redesign-view-table'));
    await setParams({ table: '1' });
    expect(await screen.findByTestId('income-redesign-table')).toBeTruthy();
  });

  it('opens Add income sheet with gross mode, statutory deduction chips, and saves a stream', async () => {
    const { sync, repo } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('income-redesign-add'));
    await setParams({ stream: 'new' });
    expect(await screen.findByTestId('income-redesign-add-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('income-redesign-name'), 'Consulting Gross');

    // Toggle gross mode
    await fireEvent.press(screen.getByText(t('income.recordMode.gross')));
    expect(screen.getByTestId('income-redesign-gross')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('income-redesign-gross'), '100000');

    // Tap Pension 8% chip to auto-calculate net
    await fireEvent.press(screen.getByText(t('income.redesign.pensionChip')));
    expect(screen.getByTestId('income-redesign-amount').props.value).toBe('92000');

    await fireEvent.press(screen.getByTestId('income-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.incomeStreams.some((r) => r.name === 'Consulting Gross')).toBe(true);
    });
  });

  it('opens Mark received sheet from stream row action', async () => {
    const { sync, repo } = await seeded();
    const snap = await repo.load();
    const sal = snap.incomeStreams.find((s) => s.name === 'Salary')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(screen.getByTestId(`income-record-${sal.id}`)).toBeTruthy();
    await fireEvent.press(screen.getByTestId(`income-record-${sal.id}`));
    expect(await screen.findByTestId('income-record-sheet')).toBeTruthy();
  });

  it('Back navigates to More', async () => {
    const { sync } = await seeded({ empty: true });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <IncomeScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('redesign-back'));
    expect(router.push).toHaveBeenCalledWith('/more');
  });
});
