import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { RedesignInvestmentsScreen } from '../RedesignInvestmentsScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

async function seeded() {
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
  return { sync, repo };
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

describe('Redesign Investments (Figma 5:1989 / 13:6330 / 11:4706)', () => {
  it('empty state matches Figma copy and opens Add investment', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<RedesignInvestmentsScreen />), { sync });
    expect(await screen.findByTestId('redesign-investments-empty')).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.emptyBody'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-investments-empty-add'));
    expect(await screen.findByTestId('redesign-add-investment-sheet')).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.addTitle'))).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.countInBudget'))).toBeTruthy();
  });

  it('portfolio card: Worth today, gain, range chips, holdings rows', async () => {
    const { sync, repo } = await seeded();
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
    await renderWithProviders(wrap(<RedesignInvestmentsScreen />), { sync });
    expect(await screen.findByTestId('redesign-investments-summary')).toBeTruthy();
    expect(screen.getByText(t('investments.redesign.worthToday'))).toBeTruthy();
    expect(screen.getByTestId('redesign-portfolio-value')).toHaveTextContent(formatNaira(40000000n));
    expect(screen.getByTestId('redesign-portfolio-gain')).toHaveTextContent(/since you started/);
    expect(screen.getByTestId('redesign-range-1Y')).toBeTruthy();
    expect(screen.getByTestId(`redesign-holding-row-${created.value.id}`)).toHaveTextContent(/Stanbic/);
    expect(screen.getByText(t('investments.redesign.freshness'))).toBeTruthy();
    expect(screen.getByTestId('redesign-view-as-table')).toBeTruthy();
  });

  it('Add investment sheet creates holding from Value today / You put in', async () => {
    const { sync, repo } = await seeded();
    setParams({ holding: 'new' });
    await renderWithProviders(wrap(<RedesignInvestmentsScreen />), { sync });
    expect(await screen.findByTestId('redesign-add-investment-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('redesign-add-investment-name'), 'Cowrywise Halal fund');
    await fireEvent.changeText(screen.getByTestId('redesign-add-investment-value'), '120000');
    await fireEvent.changeText(screen.getByTestId('redesign-add-investment-put-in'), '110000');
    await fireEvent.press(screen.getByTestId('redesign-add-investment-save'));
    await waitFor(async () => {
      const snap = await repo.load();
      expect(snap.holdings.some((h) => h.name === 'Cowrywise Halal fund')).toBe(true);
    });
    await waitFor(() => expect(screen.queryByTestId('redesign-add-investment-sheet')).toBeNull());
  });

  it('top bar has Back and Add; no bottom nav on stack frame', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const inv = s.accounts.find((a) => a.type === 'investment')!;
    await repo.seedHoldingBook({
      name: 'Risevest',
      type: 'stock',
      accountId: inv.id,
      costMinor: 22350000n,
      valueMinor: 25000000n,
    });
    await renderWithProviders(wrap(<RedesignInvestmentsScreen />), { sync });
    expect(await screen.findByTestId('redesign-back')).toBeTruthy();
    expect(screen.getByTestId('redesign-investments-add')).toBeTruthy();
    expect(screen.queryByTestId('redesign-bottom-nav')).toBeNull();
  });
});
