import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { AddTransactionProvider } from '@/features/transactions/AddTransaction';
import { t } from '@/i18n';
import { ledgerBalance } from '@/ledger';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { ReconcileScreen } from '../ReconcileScreen';

jest.mock('expo-router', () => {
  const actual = require('../../../../test/helpers/router');
  return {
    ...actual,
    useNavigation: () => ({
      setOptions: jest.fn(),
      addListener: jest.fn(() => jest.fn()),
    }),
  };
});

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
  const s = await repo.load();
  const id = s.accounts[0]!.id;
  return { sync, repo, id };
}

const wrap = (el: React.ReactElement) => (
  <WorkspaceProvider workspaceId="ws-personal">
    <AddTransactionProvider>{el}</AddTransactionProvider>
  </WorkspaceProvider>
);

beforeEach(() => {
  resetParams();
  jest.clearAllMocks();
});

describe('Page 10 redesign Reconcile', () => {
  it('renders Figma copy, bank balance field, and totals', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByText(t('redesign.reconcile.title'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.hint'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.balanceLabel'))).toBeTruthy();
    expect(screen.getByTestId('reconcile-statement')).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.myledjaShows'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.bankShows'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.difference'))).toBeTruthy();
    expect(screen.getByText(t('redesign.reconcile.tickHeading'))).toBeTruthy();
    expect(screen.getByTestId('reconcile-finish')).toBeTruthy();
  });

  it('shows pending bank amount until entered, then difference', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-says-pending')).toBeTruthy();
    expect(screen.getByTestId('reconcile-difference-pending')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '410300');
    expect(await screen.findByTestId('reconcile-says')).toHaveTextContent('₦410,300.00');
    expect(screen.getByTestId('reconcile-cleared')).toHaveTextContent('₦412,500.00');
    expect(screen.getByTestId('reconcile-difference')).toBeTruthy();
    expect(screen.getByTestId('reconcile-difference-ruby')).toBeTruthy();
  });

  it('Finish at matching balance locks ticked rows', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '412500');
    await fireEvent.press(screen.getByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    await waitFor(async () => expect((await repo.load()).events.find((e) => e.id === opening.id)?.reconciledBy).toBeTruthy());
  });

  it('offers adjustment when bank differs, posts without income or spending', async () => {
    const { sync, repo, id } = await seeded();
    const opening = (await repo.load()).events.find((e) => e.type === 'opening_balance')!;
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`reconcile-tick-${opening.id}`));
    await fireEvent.changeText(screen.getByTestId('reconcile-statement'), '410300');
    await fireEvent.press(screen.getByTestId('reconcile-finish'));
    expect(await screen.findByText(t('reconcile.adjustConfirm'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('redesign-dialog-confirm'));
    await waitFor(async () => expect(ledgerBalance(id, (await repo.load()).events)).toBe(41_030_000n));
  });

  it('Cancel asks leave without finishing', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    expect(await screen.findByTestId('reconcile-cancel')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('reconcile-cancel'));
    expect(await screen.findByText(t('reconcile.leaveTitle'))).toBeTruthy();
  });

  it('Add missing opens Add with this account', async () => {
    const { sync, id } = await seeded();
    setParams({ id });
    await renderWithProviders(wrap(<ReconcileScreen />), { sync });
    await fireEvent.changeText(await screen.findByTestId('reconcile-statement'), '412500');
    await fireEvent.press(screen.getByTestId('reconcile-add-missing'));
    expect(router.setParams).toHaveBeenCalledWith(expect.objectContaining({ add: 'expense', account: id }));
  });
});
