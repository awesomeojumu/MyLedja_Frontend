import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { AccountsScreen } from '../AccountsScreen';
import { redesignGroupFor, REDESIGN_ACCOUNT_GROUPS } from '../redesignGroups';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/features/banking/monoConnect', () => ({
  bankConnectAvailable: () => true,
  openMonoConnect: jest.fn(async () => 'mono-code-1'),
}));

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
      { name: 'GTBank Current', type: 'bank', openingBalance: '41250000', openingDate: '2026-10-01' },
      { name: 'Cash wallet', type: 'cash', openingBalance: '1820000', openingDate: '2026-10-01' },
      { name: 'PiggyVest', type: 'savings', openingBalance: '65000000', openingDate: '2026-10-01' },
      { name: 'Car loan', type: 'loan', openingBalance: '23540000', openingDate: '2026-10-01' },
      { name: 'Stanbic IBTC fund', type: 'investment', openingBalance: '40000000', openingDate: '2026-10-01' },
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
  jest.clearAllMocks();
});

describe('Page 08 redesign Accounts', () => {
  it('maps kinds to Figma groups', () => {
    expect(redesignGroupFor('bank')).toBe('everyday');
    expect(redesignGroupFor('savings')).toBe('savings');
    expect(redesignGroupFor('card')).toBe('creditLoans');
    expect(redesignGroupFor('loan')).toBe('creditLoans');
    expect(redesignGroupFor('investment')).toBe('investments');
    expect(REDESIGN_ACCOUNT_GROUPS[0]).toBe('everyday');
  });

  it('renders net worth card, Figma groups, and Connect a bank / Add account', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('redesign-net-worth-card')).toBeTruthy();
    expect(screen.getByTestId('net-worth')).toBeTruthy();
    expect(screen.getByTestId('you-own')).toBeTruthy();
    expect(screen.getByTestId('you-owe')).toBeTruthy();
    expect(screen.getByTestId('redesign-group-everyday')).toBeTruthy();
    expect(screen.getByTestId('redesign-group-savings')).toBeTruthy();
    expect(screen.getByTestId('redesign-group-creditLoans')).toBeTruthy();
    expect(screen.getByTestId('redesign-group-investments')).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.group.everyday'))).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.connect'))).toBeTruthy();
    expect(screen.getAllByText(t('redesign.accounts.add')).length).toBeGreaterThan(0);
  });

  it('opens Add account sheet from ?account=new with Figma fields', async () => {
    const { sync } = await seeded();
    setParams({ account: 'new' });
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('redesign-add-account-sheet')).toBeTruthy();
    expect(screen.getByTestId('redesign-account-name')).toBeTruthy();
    expect(screen.getByTestId('redesign-account-type')).toBeTruthy();
    expect(screen.getByTestId('redesign-account-currency')).toBeTruthy();
    expect(screen.getByTestId('redesign-account-balance')).toBeTruthy();
    expect(screen.getByTestId('redesign-count-in-budget')).toBeTruthy();
  });

  it('opens Connect a bank search with Popular banks', async () => {
    const { sync } = await seeded();
    setParams({ connect: '1' });
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('redesign-connect-bank-sheet')).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.popular'))).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.connectPrivacy'))).toBeTruthy();
    expect(screen.getByTestId('redesign-bank-gtbank')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-bank-gtbank'));
    await waitFor(() => expect(screen.getByTestId('redesign-connect-bank-flow')).toBeTruthy());
    expect(screen.getByText(t('redesign.connect.beforeBody'))).toBeTruthy();
    expect(screen.getByText(t('redesign.connect.continueToBank', { bank: 'GTBank' }))).toBeTruthy();
  });

  it('renders assets vs debts ratio bar and see portfolio link', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('net-worth-ratio-bar')).toBeTruthy();
    expect(screen.getByTestId('net-worth-ratio-assets')).toBeTruthy();
    expect(screen.getByTestId('net-worth-ratio-debts')).toBeTruthy();
    expect(screen.getByTestId('investments-see-portfolio')).toBeTruthy();
  });

  it('toggles discreet privacy mode across all account cards', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('accounts-privacy-toggle')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('accounts-privacy-toggle'));
    expect(screen.getByTestId('net-worth')).toBeTruthy();
  });

  it('filters accounts via search input and category chips', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('accounts-search')).toBeTruthy();
    expect(screen.getByTestId('accounts-filter-all')).toBeTruthy();
    expect(screen.getByTestId('accounts-filter-cash')).toBeTruthy();

    // Type into search
    await fireEvent.changeText(screen.getByTestId('accounts-search'), 'Piggy');
    expect(screen.getByText('PiggyVest')).toBeTruthy();
    expect(screen.queryByText('Car loan')).toBeNull();

    // Reset search and use filter chip
    await fireEvent.changeText(screen.getByTestId('accounts-search'), '');
    await fireEvent.press(screen.getByTestId('accounts-filter-cash'));
    expect(screen.getByText('GTBank Current')).toBeTruthy();
    expect(screen.queryByText('Car loan')).toBeNull();
  });

  it('toggles reorder mode and triggers sync all', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('accounts-reorder-toggle')).toBeTruthy();
    expect(screen.getByTestId('accounts-sync-all')).toBeTruthy();

    // Reorder mode
    await fireEvent.press(screen.getByTestId('accounts-reorder-toggle'));
    expect(screen.getByText(t('redesign.accounts.reorderDone'))).toBeTruthy();

    // Sync all
    await fireEvent.press(screen.getByTestId('accounts-sync-all'));
  });

  it('opens account action bottom sheet on long press', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const gt = s.accounts.find((a) => a.name === 'GTBank Current')!;
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    const row = await screen.findByTestId(`account-${gt.id}`);
    await fireEvent(row, 'longPress');
    expect(await screen.findByTestId('account-action-sheet')).toBeTruthy();
    expect(screen.getByTestId('account-action-add-tx')).toBeTruthy();
    expect(screen.getByTestId('account-action-transfer')).toBeTruthy();
    expect(screen.getByTestId('account-action-reconcile')).toBeTruthy();
    expect(screen.getByTestId('account-action-edit')).toBeTruthy();
  });

  it('shows empty state copy from Figma', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [],
      categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('redesign-empty')).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('redesign.accounts.emptyBody'))).toBeTruthy();
  });
});
