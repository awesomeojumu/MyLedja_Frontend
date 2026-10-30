import { fireEvent, screen } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { CategoryScreen } from '../CategoryScreen';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));
jest.mock('@/design/redesign/flag', () => ({
  isRedesignEnabled: () => true,
}));

let mockWidth = 390;
let mockHeight = 844;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 1, fontScale: 1 }),
}));

async function seeded(over = true) {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Food' },
      { key: 'cat.fuel', group: 'group.gettingAround', name: 'Transport' },
    ],
    budgetStyle: 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  await repo.setAssigned(id('Food'), '2026-10', 60_000_000n);
  await repo.setAssigned(id('Transport'), '2026-10', 40_000_000n);
  if (over) {
    await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Food'), amount: 62_400_000n }],
      date: '2026-10-20',
      payeeName: 'Shoprite Lekki',
    });
  }
  return { sync, repo, id, foodId: id('Food') };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  mockWidth = 390;
  mockHeight = 844;
  resetParams();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Page 07 redesign Category (EXPO_PUBLIC_REDESIGN on)', () => {
  it('renders Figma status, change plan, move money in, last 6 months, transactions', async () => {
    const { sync, foodId } = await seeded();
    setParams({ id: foodId });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('redesign-category-frame')).toBeTruthy();
    expect(screen.getByTestId('category-status')).toBeTruthy();
    expect(screen.getByTestId('category-over-plan')).toBeTruthy();
    expect(screen.getByText(t('category.redesign.changePlan'))).toBeTruthy();
    expect(screen.getByText(t('category.redesign.moveMoneyIn'))).toBeTruthy();
    expect(screen.getByTestId('category-history')).toBeTruthy();
    expect(screen.getByText(t('category.redesign.last6Months'))).toBeTruthy();
    expect(screen.getByText(t('category.redesign.viewAsTable'))).toBeTruthy();
    expect(screen.getByTestId('category-transactions')).toBeTruthy();
    expect(screen.getByText('Shoprite Lekki')).toBeTruthy();
  });

  it('opens Change plan via setParams', async () => {
    const { sync, foodId } = await seeded();
    setParams({ id: foodId });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('category-change-plan'));
    expect(router.setParams).toHaveBeenCalledWith({ plan: '1' });
  });

  it('opens Edit category sheet from ?category=', async () => {
    const { sync, foodId } = await seeded();
    setParams({ id: foodId, category: foodId });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('category-edit-name')).toBeTruthy();
  });

  it('missing category shows empty state', async () => {
    const { sync } = await seeded(false);
    setParams({ id: 'missing-id' });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByText(t('category.missingTitle'))).toBeTruthy();
    expect(screen.getByText(t('category.missingBody'))).toBeTruthy();
  });

  it('toggles view as table', async () => {
    const { sync, foodId } = await seeded();
    setParams({ id: foodId });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('category-view-table'));
    expect(router.setParams).toHaveBeenCalledWith({ table: '1' });
  });

  it('web layout shows side summary Planned/Spent/Left', async () => {
    mockWidth = 1280;
    mockHeight = 800;
    const { sync, foodId } = await seeded();
    setParams({ id: foodId });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('category-side-summary')).toBeTruthy();
    expect(screen.getByTestId('category-planned')).toBeTruthy();
    expect(screen.getByTestId('category-spent')).toBeTruthy();
    expect(screen.getByTestId('category-remaining')).toBeTruthy();
  });

  it('i18n Figma strings are wired', () => {
    expect(t('category.redesign.changePlan')).toBe('Change plan');
    expect(t('category.redesign.moveMoneyIn')).toBe('Move money in');
    expect(t('category.redesign.overPlanBy', { amount: '₦2,400.00' })).toBe('Over plan by ₦2,400.00');
    expect(t('category.redesign.ofPlan', { spent: '₦62,400.00', planned: '₦60,000.00' })).toBe(
      '₦62,400.00 of ₦60,000.00',
    );
  });
});
