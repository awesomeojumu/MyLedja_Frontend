import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { ledgerBalance } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { AccountsScreen } from '../AccountsScreen';
import { ConnectBankSheet, EditAccountSheet } from '../accountSheets';
import { ACCOUNT_KINDS_BY_GROUP, reorderAccountIds } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

jest.mock('@/features/banking/monoConnect', () => ({
  bankConnectAvailable: () => true,
  openMonoConnect: jest.fn(async () => 'mono-code-1'),
}));

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [
      { name: 'GTBank', type: 'bank', openingBalance: '81230000', openingDate: '2026-10-01' },
      { name: 'OPay', type: 'wallet', openingBalance: '0', openingDate: '2026-10-01' },
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

describe('Page 08 Accounts gaps', () => {
  it('P08-03 / PU-13: type grid includes BE kinds (pension, fixed deposit, other asset/liability)', async () => {
    const { sync } = await seeded();
    setParams({ account: 'new' });
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('type-bank')).toBeTruthy();
    expect(screen.getByTestId('type-pension')).toBeTruthy();
    expect(screen.getByTestId('type-fixed_deposit')).toBeTruthy();
    expect(screen.getByTestId('type-other_asset')).toBeTruthy();
    expect(screen.getByTestId('type-other_liability')).toBeTruthy();
    expect(ACCOUNT_KINDS_BY_GROUP.investments).toEqual(expect.arrayContaining(['investment', 'fixed_deposit', 'pension']));
    expect(ACCOUNT_KINDS_BY_GROUP.other).toEqual(['other_asset', 'other_liability']);
  });

  it('P08-07: reorderAccountIds drops fromId onto toId', () => {
    expect(reorderAccountIds(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b']);
    expect(reorderAccountIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('PU-16: Choose → Mono wait → Match → History; cancel connects nothing', async () => {
    const { openMonoConnect } = require('@/features/banking/monoConnect') as { openMonoConnect: jest.Mock };
    openMonoConnect.mockResolvedValueOnce(null);
    const { sync } = await seeded();
    const onClose = jest.fn();
    await renderWithProviders(wrap(<ConnectBankSheet onClose={onClose} />), { sync });
    expect(screen.getByText(t('accounts.connect.monoBody'))).toBeTruthy();
    expect(screen.queryByTestId('connect-bank-history')).toBeNull();
    await fireEvent.press(screen.getByTestId('connect-bank-continue'));
    await waitFor(() => expect(openMonoConnect).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByText(t('accounts.connect.monoBody'))).toBeTruthy());
    expect(onClose).not.toHaveBeenCalled();

    openMonoConnect.mockResolvedValueOnce('code-ok');
    await fireEvent.press(screen.getByTestId('connect-bank-continue'));
    await waitFor(() => expect(screen.getByTestId('connect-bank-account')).toBeTruthy());
    expect(screen.queryByTestId('connect-bank-history')).toBeNull();
    await waitFor(() => expect(screen.getByTestId('connect-bank-match-continue')).not.toBeDisabled());
    await fireEvent.press(screen.getByTestId('connect-bank-match-continue'));
    expect(await screen.findByTestId('connect-bank-history')).toBeTruthy();
  });

  it('PU-13: editing opening balance posts a correction that is not income', async () => {
    const { sync, repo } = await seeded();
    const s = await repo.load();
    const gt = s.accounts.find((a) => a.name === 'GTBank')!;
    await renderWithProviders(wrap(<EditAccountSheet account={gt} onClose={jest.fn()} />), { sync });
    expect(await screen.findByTestId('edit-account-opening')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('edit-account-opening'), '900000');
    await fireEvent.press(screen.getByTestId('edit-account-save'));
    await waitFor(async () => expect(ledgerBalance(gt.id, (await repo.load()).events)).toBe(90_000_000n));
    const events = (await repo.load()).events;
    expect(events.some((e) => e.type === 'income')).toBe(false);
    expect(events.some((e) => e.type === 'balance_adjustment')).toBe(true);
  });

  it('clears ?connect= when Connect bank closes', async () => {
    const { sync } = await seeded();
    setParams({ connect: '1' });
    const { router } = require('../../../../test/helpers/router') as { router: { setParams: jest.Mock } };
    await renderWithProviders(wrap(<AccountsScreen />), { sync });
    expect(await screen.findByTestId('connect-bank-sheet')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByText(t('common.cancel')));
    });
    expect(router.setParams).toHaveBeenCalledWith({ connect: undefined });
  });
});
