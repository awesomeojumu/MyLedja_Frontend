import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { RedesignHoldingScreen } from '../RedesignHoldingScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

async function seededWithHolding() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' },
      { name: 'Brokerage', type: 'investment', openingBalance: '0', openingDate: '2026-10-01' },
    ],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const inv = s.accounts.find((a) => a.type === 'investment')!;
  const created = await repo.seedHoldingBook({
    name: 'Stanbic IBTC fund',
    type: 'fund',
    accountId: inv.id,
    costMinor: 37200000n,
    valueMinor: 40000000n,
  });
  if (!created.ok) throw new Error('seed');
  return { sync, repo, holding: created.value };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Redesign Holding (Figma 5:2062 / 5:2131)', () => {
  it('shows Worth today, details, history, Update value and Add money', async () => {
    const { sync, holding } = await seededWithHolding();
    setParams({ id: holding.id });
    await renderWithProviders(wrap(<RedesignHoldingScreen />), { sync });
    expect(await screen.findByTestId('redesign-holding-value')).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.worthToday'))).toBeTruthy();
    expect(screen.getByTestId('redesign-holding-amount')).toHaveTextContent(formatNaira(40000000n));
    expect(screen.getByTestId('redesign-holding-details')).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.youPutIn'))).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.countsInBudget'))).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.history'))).toBeTruthy();
    expect(screen.getByTestId('redesign-holding-footer')).toHaveStyle({ flexDirection: 'column' });
    expect(screen.getByTestId('redesign-holding-update')).toBeTruthy();
    expect(screen.getByTestId('redesign-holding-add-money')).toBeTruthy();
    expect(screen.getByTestId('redesign-holding-more')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });

  it('Update value sheet saves a new price', async () => {
    const { sync, repo, holding } = await seededWithHolding();
    setParams({ id: holding.id, sheet: 'update' });
    await renderWithProviders(wrap(<RedesignHoldingScreen />), { sync });
    expect(await screen.findByTestId('redesign-update-value-sheet')).toBeTruthy();
    expect(screen.getByTestId('redesign-update-value-amount')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('redesign-update-value-amount'), '404200');
    await fireEvent.press(screen.getByTestId('redesign-update-value-save'));
    await waitFor(async () => {
      const snap = await repo.load();
      const latest = snap.prices
        .filter((p) => p.holdingId === holding.id)
        .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0];
      expect(latest?.priceMinor).toBe('40420000');
    });
  });

  it('missing holding shows empty state', async () => {
    const { sync } = await seededWithHolding();
    setParams({ id: 'missing-id' });
    await renderWithProviders(wrap(<RedesignHoldingScreen />), { sync });
    expect(await screen.findByTestId('redesign-holding-missing')).toBeTruthy();
    expect(screen.getByText(t('investments.missingTitle'))).toBeTruthy();
  });
});
