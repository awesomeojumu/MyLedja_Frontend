import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { PayeesScreen } from '../PayeesScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({ isRedesignEnabled: () => true }));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ granted: false })),
  requestMediaLibraryPermissionsAsync: jest.fn(async () => ({ granted: false })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true })),
  launchImageLibraryAsync: jest.fn(async () => ({ canceled: true })),
}));

async function seeded() {
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
  const s = await repo.load();
  const accountId = s.accounts[0]!.id;
  const marketId = s.categories.find((c) => c.name === 'Market')!.id;
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 5_000_000n }],
    date: '2026-10-12',
    payeeName: 'Shoprite Lekki',
  });
  await repo.addTransaction({
    kind: 'expense',
    accountId,
    parts: [{ categoryId: marketId, amount: 2_000_000n }],
    date: '2026-10-15',
    payeeName: 'Corner shop',
  });
  const shop = (await repo.load()).payees.find((p) => p.name === 'Shoprite Lekki')!;
  await repo.updatePayee({ ...shop, defaultCategoryId: marketId });
  return { sync, repo, marketId, accountId };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  resetParams();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Page 24 redesign Payees (EXPO_PUBLIC_REDESIGN on)', () => {
  it('lists payees with chips, subtitle, and spent trailing (Figma 6:2230)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-payees')).toBeTruthy();
    expect(screen.getByText('Shoprite Lekki')).toBeTruthy();
    expect(screen.getByText('Corner shop')).toBeTruthy();
    expect(screen.getByTestId('payees-chip-all')).toBeTruthy();
    expect(screen.getByTestId('payees-chip-mostUsed')).toBeTruthy();
    expect(screen.getByTestId('payees-chip-notSorted')).toBeTruthy();
    expect(screen.getByText(t('payees.redesign.listHint'))).toBeTruthy();
    expect(screen.getAllByText(/Market, 1 time/).length).toBeGreaterThanOrEqual(1);
  });

  it('filters Not sorted chip to payees without a default category', async () => {
    const { sync, repo } = await seeded();
    const corner = (await repo.load()).payees.find((p) => p.name === 'Corner shop')!;
    await repo.updatePayee({ ...corner, defaultCategoryId: undefined });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    await fireEvent.press(await screen.findByTestId('payees-chip-notSorted'));
    expect(screen.queryByText('Shoprite Lekki')).toBeNull();
    expect(screen.getByText('Corner shop')).toBeTruthy();
  });

  it('opens payee detail from ?payee= with spent card and rename (Figma 8:3481 / 12:5589)', async () => {
    const { sync, repo } = await seeded();
    const shop = (await repo.load()).payees.find((p) => p.name === 'Shoprite Lekki')!;
    await act(async () => setParams({ payee: shop.id }));
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('redesign-payee-detail')).toBeTruthy();
    expect(screen.getByText(t('payees.redesign.spentHere'))).toBeTruthy();
    expect(screen.getByTestId('payee-spent-year')).toBeTruthy();
    expect(screen.getByText(t('payees.redesign.mergeWith'))).toBeTruthy();
    await fireEvent.press(screen.getByTestId('payee-name'));
    expect(await screen.findByTestId('payee-rename-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('payee-rename-input'), 'Shoprite');
    await fireEvent.press(screen.getByTestId('payee-rename-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.payees.find((p) => p.id === shop.id)?.name).toBe('Shoprite');
    });
  });

  it('merge screen merges checked payees with Undo (Figma 12:5666)', async () => {
    const { sync, repo } = await seeded();
    const before = await repo.load();
    const shop = before.payees.find((p) => p.name === 'Shoprite Lekki')!;
    const corner = before.payees.find((p) => p.name === 'Corner shop')!;
    await act(async () => setParams({ merge: `${shop.id},${corner.id}` }));
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('payees-merge-sheet')).toBeTruthy();
    expect(screen.getByText(t('payees.redesign.mergeIntro'))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('payees-merge-keep-name'), 'Shoprite');
    await fireEvent.press(screen.getByTestId('payees-merge-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(after.payees).toHaveLength(1);
      expect(after.payees[0]!.name).toBe('Shoprite');
      expect(after.events.filter((e) => e.payeeId === shop.id)).toHaveLength(2);
    });
  });

  it('empty state matches Figma 13:6372 copy', async () => {
    const sync = memorySync();
    const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
    await repo.seedFromSetup({
      workspaceName: 'Personal',
      currency: 'NGN',
      weekStart: 'monday',
      accounts: [{ name: 'Cash', type: 'cash', openingBalance: '0', openingDate: '2026-10-01' }],
      categories: [],
      budgetStyle: 'tracking',
      monthlyTakeHome: null,
      skippedSteps: [],
    });
    await renderWithProviders(
      <WorkspaceProvider workspaceId="ws-personal">
        <PayeesScreen />
      </WorkspaceProvider>,
      { sync },
    );
    expect(await screen.findByTestId('payees-empty')).toBeTruthy();
    expect(screen.getByText(t('payees.emptyTitle'))).toBeTruthy();
    expect(screen.getByText(t('payees.redesign.emptyBody'))).toBeTruthy();
  });
});
