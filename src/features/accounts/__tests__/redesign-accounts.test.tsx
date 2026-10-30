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
    await waitFor(() => expect(screen.getByText(t('accounts.connect.monoBody'))).toBeTruthy());
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
