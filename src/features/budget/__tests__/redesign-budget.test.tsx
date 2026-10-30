import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';

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

async function seeded(opts: { planned?: boolean; envelope?: boolean } = {}) {
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
    budgetStyle: opts.envelope ? 'envelope' : 'tracking',
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  if (opts.planned !== false) {
    await repo.setAssigned(id('Rent'), '2026-10', 75_000_000n);
    await repo.setAssigned(id('Food'), '2026-10', 60_000_000n);
    await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Food'), amount: 62_400_000n }],
      date: '2026-10-20',
      payeeName: 'Shoprite',
    });
    await repo.addTransaction({
      kind: 'income',
      accountId: id('GTBank'),
      categoryId: s.categories.find((c) => c.key === 'cat.salary')!.id,
      amount: 520_000_000n,
      date: '2026-10-01',
    });
  }
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

describe('Page 06 redesign Budget (EXPO_PUBLIC_REDESIGN on)', () => {
  it('renders Figma phone chrome: month strip, left-to-spend summary, Fixed/Flexible groups', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    expect(screen.getByTestId('budget-month')).toHaveTextContent('October 2026');
    expect(screen.getByTestId('budget-choose-month')).toBeTruthy();
    expect(screen.getByTestId('budget-summary')).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.leftToSpend'))).toBeTruthy();
    expect(screen.getByTestId('budget-left-to-spend')).toBeTruthy();
    expect(screen.getByTestId(`budget-row-${id('Rent')}`)).toBeTruthy();
    expect(screen.getByTestId(`budget-row-${id('Food')}`)).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.addCategory'))).toBeTruthy();
  });

  it('shows Over plan on overspent category and of-plan caption', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId(`budget-over-${id('Food')}`)).toBeTruthy();
    expect(screen.getAllByText(t('redesign.overPlan')).length).toBeGreaterThan(0);
    // 60_000_000n kobo → ₦600,000.00
    expect(screen.getByText(/of ₦600,000\.00/)).toBeTruthy();
  });

  it('empty month uses Figma copy and Plan your budget / Copy last month', async () => {
    const { sync } = await seeded({ planned: false });
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByText(t('budget.redesign.emptyTitle', { month: 'October' }))).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.emptyBody'))).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.planYourBudget'))).toBeTruthy();
    expect(screen.getByText(t('budget.menuCopyLast'))).toBeTruthy();
  });

  it('opens choose-month sheet from calendar trailing', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-choose-month'));
    expect(await screen.findByTestId('budget-choose-month-sheet')).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.chooseMonth'))).toBeTruthy();
    expect(screen.getByTestId('budget-month-option-2026-10')).toBeTruthy();
    expect(screen.getByTestId('budget-show-month')).toHaveTextContent('Show October 2026');
  });

  it('opens Edit amount via ?plan= (specs win on flows)', async () => {
    const { sync, id } = await seeded();
    setParams({ plan: id('Rent') });
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-edit-amount')).toBeTruthy();
  });

  it('envelope not-planned banner uses Figma copy', async () => {
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
    const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
    await repo.addTransaction({
      kind: 'income',
      accountId: id('GTBank'),
      categoryId: s.categories.find((c) => c.key === 'cat.salary')!.id,
      amount: 520_000_000n,
      date: '2026-10-01',
    });
    // Plan only a little so left-to-plan stays positive (no overspend)
    await repo.setAssigned(id('Rent'), '2026-10', 50_000_000n);
    await repo.setAssigned(id('Food'), '2026-10', 50_000_000n);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-not-planned')).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.planIt'))).toBeTruthy();
    expect(screen.getByText(/not planned yet/)).toBeTruthy();
  });

  it('web layout shows Copy last month and summary column', async () => {
    mockWidth = 1280;
    mockHeight = 800;
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('redesign-budget')).toBeTruthy();
    expect(screen.getByTestId('budget-copy-last')).toBeTruthy();
    expect(screen.getByTestId('budget-summary')).toBeTruthy();
    expect(screen.getByText(t('budget.redesign.leftToSpend'))).toBeTruthy();
  });

  it('i18n Figma strings are wired', () => {
    expect(t('budget.redesign.leftToSpend')).toBe('Left to spend');
    expect(t('budget.redesign.ofPlan', { spent: '₦0.00', planned: '₦75,000.00' })).toBe('₦0.00 of ₦75,000.00');
    expect(t('budget.redesign.emptyTitle', { month: 'October' })).toBe('No budget for October yet');
    expect(t('budget.redesign.showMonth', { month: 'October 2026' })).toBe('Show October 2026');
  });

  it('collapses a type group', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    const rent = await screen.findByTestId(`budget-row-${id('Rent')}`);
    expect(rent).toBeTruthy();
    // Rent is typically fixed; Food flexible — toggle whichever group hosts Rent
    const groupToggle =
      screen.queryByTestId('budget-group-toggle-fixed') ?? screen.getByTestId('budget-group-toggle-flexible');
    await fireEvent.press(groupToggle);
    await waitFor(() => {
      expect(screen.queryByTestId(`budget-row-${id('Rent')}`)).toBeNull();
    });
  });
});
