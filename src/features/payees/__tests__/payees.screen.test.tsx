import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { PayeesScreen } from '../PayeesScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

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
  const s = await repo.load();
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Shoprite',
  });
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 2_000_000n }],
    date: '2026-10-15',
    payeeName: 'Corner shop',
  });
  return { sync, repo };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Payees page', () => {
  it('P24-01: lists payees with counts', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByText('Shoprite')).toBeTruthy();
    expect(screen.getByText('Corner shop')).toBeTruthy();
    expect(screen.getAllByText(t('payees.txCount', { count: 1 })).length).toBe(2);
  });

  it('P24-03: aliases on a payee match imports', async () => {
    const { sync, repo } = await seeded();
    const shop = (await repo.load()).payees.find((p) => p.name === 'Shoprite')!;
    await repo.updatePayee({ ...shop, aliases: ['POS SHOPRITE LEKKI'] });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByText('Shoprite'));
    expect(screen.getByTestId('payee-aliases')).toBeTruthy();
  });

  it('P24-04: merge moves transactions to the kept payee', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    const shop = before.payees.find((p) => p.name === 'Shoprite')!;
    const corner = before.payees.find((p) => p.name === 'Corner shop')!;
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(screen.getByTestId('payees-merge'));
    await fireEvent.press(screen.getByTestId('payees-merge-keep'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Shoprite' }));
    await fireEvent.press(screen.getByTestId('payees-merge-from'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Corner shop' }));
    await fireEvent.press(screen.getByTestId('payees-merge-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.payees.map((p) => p.name)).toEqual(['Shoprite']);
      expect(after.events.filter((e) => e.payeeId === shop.id)).toHaveLength(2);
    });
    void corner;
  });
});
