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

async function seeded(opts?: { empty?: boolean }) {
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
    await repo.addIncomeStream({
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
    expect(screen.getByText(t('income.redesign.varies'))).toBeTruthy();
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

  it('opens Add income sheet and saves a stream', async () => {
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
    await fireEvent.changeText(screen.getByTestId('income-redesign-name'), 'Rent from tenant');
    await fireEvent.changeText(screen.getByTestId('income-redesign-amount'), '40000');
    await fireEvent.press(screen.getByTestId('income-redesign-save'));
    await waitFor(async () => {
      const s = await repo.load();
      expect(s.incomeStreams.some((r) => r.name === 'Rent from tenant')).toBe(true);
    });
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
