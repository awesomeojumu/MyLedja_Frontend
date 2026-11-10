import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, setParams } from '../../../../test/helpers/router';
import { BudgetScreen } from '../BudgetScreen';

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

async function seeded() {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.rent', group: 'group.home', name: 'Rent' },
      { key: 'cat.market', group: 'group.food', name: 'Food' },
    ],
    budgetStyle: 'envelope',
    monthlyTakeHome: null,
    skippedSteps: [],
  });

  const s = await repo.load();
  const rentCat = s.categories.find((c) => c.name === 'Rent')!;
  const foodCat = s.categories.find((c) => c.name === 'Food')!;
  await repo.updateCategory({ ...rentCat, carryOver: true, budgetType: 'fixed' });
  await repo.updateCategory({ ...foodCat, budgetType: 'flexible' });

  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;

  // Plan October
  await repo.setAssigned(id('Rent'), '2026-10', 75_000_000n);
  await repo.setAssigned(id('Food'), '2026-10', 50_000_000n);

  // Spend in October (Food overspent by ₦10,000)
  await repo.addTransaction({
    kind: 'expense',
    accountId: id('GTBank'),
    parts: [{ categoryId: id('Food'), amount: 60_000_000n }],
    date: '2026-10-15',
    payeeName: 'Grocery Store',
  });

  // Add income
  await repo.addTransaction({
    kind: 'income',
    accountId: id('GTBank'),
    categoryId: s.categories.find((c) => c.key === 'cat.salary')!.id,
    amount: 500_000_000n,
    date: '2026-10-01',
  });

  return { sync, repo, id };
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

describe('Budget Upgrades (RedesignBudgetScreen)', () => {
  it('renders visual badges: carryover and pace', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    expect(screen.getByTestId(`budget-mark-carryover-${id('Rent')}`)).toBeTruthy();
    expect(screen.getByTestId(`budget-pace-${id('Rent')}`)).toBeTruthy();
  });

  it('filters categories using search input and toggles all groups', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    expect(screen.getByTestId(`budget-row-${id('Rent')}`)).toBeTruthy();
    expect(screen.getByTestId(`budget-row-${id('Food')}`)).toBeTruthy();

    // Type "Food" into search
    const searchInput = screen.getByTestId('budget-search-input');
    await fireEvent.changeText(searchInput, 'Food');

    await waitFor(() => {
      expect(screen.getByTestId(`budget-row-${id('Food')}`)).toBeTruthy();
      expect(screen.queryByTestId(`budget-row-${id('Rent')}`)).toBeNull();
    });

    // Toggle all groups to collapse
    const toggleAll = screen.getByTestId('budget-toggle-all-groups');
    await fireEvent.press(toggleAll);

    await waitFor(() => {
      expect(screen.queryByTestId(`budget-row-${id('Food')}`)).toBeNull();
    });
  });

  it('opens row context sheet on long press and offers actions', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    const rentRow = screen.getByTestId(`budget-row-${id('Rent')}`);
    await fireEvent(rentRow, 'longPress');

    expect(await screen.findByTestId('budget-row-context-sheet')).toBeTruthy();
    expect(screen.getByTestId('budget-context-move')).toBeTruthy();
    expect(screen.getByTestId('budget-context-tx')).toBeTruthy();
    expect(screen.getByTestId('budget-context-view-category')).toBeTruthy();
    expect(screen.getByTestId('budget-context-template')).toBeTruthy();
    expect(screen.getByTestId('budget-context-copy-last')).toBeTruthy();
  });

  it('opens batch tools sheet and supports quick actions', async () => {
    mockWidth = 1280;
    mockHeight = 800;
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    const batchChip = await screen.findByTestId('budget-batch-tools');
    await fireEvent.press(batchChip);

    expect(await screen.findByTestId('budget-batch-sheet')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-copy-last')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-copy-actual')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-fill-averages')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-apply-templates')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-scale-five')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-scale-ten')).toBeTruthy();
    expect(screen.getByTestId('budget-batch-zero')).toBeTruthy();
  });

  it('renders multi-month 3-month grid view on desktop when monthSpan is 3', async () => {
    mockWidth = 1280;
    mockHeight = 800;
    setParams({ months: '3' });
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    // Columns header for 3 months
    const cols = await screen.findAllByTestId('budget-columns-3');
    expect(cols.length).toBeGreaterThan(0);
    // 3 month columns per row
    expect(screen.getByTestId(`budget-month-cols-${id('Rent')}-2026-10`)).toBeTruthy();
    expect(screen.getByTestId(`budget-month-cols-${id('Rent')}-2026-09`)).toBeTruthy();
    expect(screen.getByTestId(`budget-month-cols-${id('Rent')}-2026-08`)).toBeTruthy();
  });

  it('supports inline editing on web platform with Enter and Tab keys', async () => {
    const originalPlatform = Platform.OS;
    Object.defineProperty(Platform, 'OS', { get: () => 'web', configurable: true });

    try {
      mockWidth = 1280;
      mockHeight = 800;
      const { sync, repo, id } = await seeded();
      await renderWithProviders(wrap(<BudgetScreen />), { sync });

      expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
      const plannedRent = await screen.findByTestId(`budget-planned-${id('Rent')}`);
      await fireEvent.press(plannedRent);

      const input = await screen.findByTestId(`budget-planned-inline-${id('Rent')}`);
      expect(input).toBeTruthy();

      // Change amount to 120000
      await fireEvent.changeText(input, '120000');
      await fireEvent(input, 'submitEditing');

      const s = await repo.load();
      expect(repo.assigned(id('Rent'), '2026-10', s)).toBe(12_000_000n);
    } finally {
      Object.defineProperty(Platform, 'OS', { get: () => originalPlatform, configurable: true });
    }
  });

  it('shows smart cover overspending suggestion when categories are overspent', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });

    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    // Food is overspent by ₦10,000 and Rent has surplus
    expect(await screen.findByTestId('budget-cover-banner')).toBeTruthy();
    expect(screen.getByTestId('budget-smart-cover')).toBeTruthy();
  });
});
