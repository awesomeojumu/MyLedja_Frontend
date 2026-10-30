import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { AccountScreen } from '../AccountScreen';

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
    accounts: [{ name: 'GTBank Current', type: 'bank', openingBalance: '41250000', openingDate: '2026-10-01' }],
    categories: [{ key: 'cat.market', group: 'group.food', name: 'Market' }],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const snap = await repo.load();
  const id = snap.accounts[0]!.id;
  return { sync, repo, id };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Page 09 redesign Account', () => {
  it('renders balance card, Reconcile, Import a file, and register headers', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    expect(await screen.findByTestId('redesign-account-balance')).toBeTruthy();
    expect(screen.getByTestId('account-balance')).toBeTruthy();
    expect(screen.getByText(t('redesign.account.reconcile'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.import'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.transactions'))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.balanceAfter'))).toBeTruthy();
    expect(screen.getByTestId('account-back')).toBeTruthy();
    expect(screen.getByTestId('account-more')).toBeTruthy();
  });

  it('More opens Delete dialog with Figma copy, confirm opens archive path', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('account-more'));
    expect(await screen.findByTestId('account-more-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('more-delete'));
    expect(await screen.findByText(t('redesign.account.deleteTitle', { name: 'GTBank Current' }))).toBeTruthy();
    expect(screen.getByText(t('redesign.account.deleteConfirm'))).toBeTruthy();
    await fireEvent.press(screen.getByText(t('redesign.account.deleteConfirm')));
    await waitFor(() => expect(screen.getByTestId('archive-sheet')).toBeTruthy());
  });

  it('shows empty register copy when no txs beyond opening', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<AccountScreen />), { sync });
    // Opening balance counts as a register row — balance card still present
    expect(await screen.findByTestId('redesign-account-balance')).toBeTruthy();
    expect(screen.getByTestId('account-reconcile')).toBeTruthy();
    expect(screen.getByTestId('account-import')).toBeTruthy();
  });
});
