import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { WorkspaceRepository } from '@/data/workspace/repository';
import { WorkspaceProvider } from '@/data/workspace/WorkspaceProvider';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

import { memorySync, renderWithProviders } from '../../../../test/helpers/render';
import { resetParams, router, setParams } from '../../../../test/helpers/router';
import { BudgetScreen } from '../BudgetScreen';
import { CategoryScreen } from '../CategoryScreen';
import { budgetForMonth, overspentCategories } from '../helpers';

jest.mock('expo-router', () => require('../../../../test/helpers/router'));

let mockWidth = 1200;
let mockHeight = 900;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: mockWidth, height: mockHeight, scale: 1, fontScale: 1 }),
}));

async function seeded(style: 'tracking' | 'envelope' = 'tracking') {
  const sync = memorySync();
  const repo = new WorkspaceRepository(sync.store, sync.engine, 'ws-personal');
  await repo.seedFromSetup({
    workspaceName: 'Personal',
    currency: 'NGN',
    weekStart: 'monday',
    accounts: [{ name: 'GTBank', type: 'bank', openingBalance: '100000000', openingDate: '2026-10-01' }],
    categories: [
      { key: 'cat.market', group: 'group.food', name: 'Market' },
      { key: 'cat.fuel', group: 'group.gettingAround', name: 'Fuel' },
    ],
    budgetStyle: style,
    monthlyTakeHome: null,
    skippedSteps: [],
  });
  const s = await repo.load();
  const id = (name: string) => [...s.accounts, ...s.categories].find((x) => x.name === name)!.id;
  await repo.setAssigned(id('Market'), '2026-10', 90_000_000n);
  await repo.setAssigned(id('Fuel'), '2026-10', 60_000_000n);
  await repo.addTransaction({
    kind: 'expense',
    accountId: id('GTBank'),
    parts: [{ categoryId: id('Market'), amount: 93_000_000n }],
    date: '2026-10-20',
    payeeName: 'Shoprite',
  });
  return { sync, repo, id };
}

const wrap = (el: React.ReactElement) => <WorkspaceProvider workspaceId="ws-personal">{el}</WorkspaceProvider>;

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-28T12:00:00Z'));
  mockWidth = 1200;
  mockHeight = 900;
  resetParams();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Budget page', () => {
  it('P06-01: planned is editable; spent and remaining update', async () => {
    const { sync, repo, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId(`budget-row-${id('Market')}`)).toBeTruthy();
    expect(screen.getByText(t('budget.col.planned'))).toBeTruthy();
    expect(screen.getByTestId(`budget-remaining-${id('Market')}`)).toHaveTextContent('−₦30,000.00', { exact: false });
    await fireEvent.press(screen.getByTestId(`budget-planned-${id('Market')}`));
    await fireEvent.changeText(screen.getByTestId('budget-edit-amount'), '100000');
    await fireEvent.press(screen.getByTestId('budget-edit-save'));
    await waitFor(async () => expect(repo.assigned(id('Market'), '2026-10', await repo.load())).toBe(10_000_000n));
  });

  it('P06-02: near and over bars use the right words', async () => {
    const { sync, repo, id } = await seeded();
    await repo.setAssigned(id('Fuel'), '2026-10', 10_000_000n);
    await repo.addTransaction({
      kind: 'expense',
      accountId: id('GTBank'),
      parts: [{ categoryId: id('Fuel'), amount: 8_500_000n }],
      date: '2026-10-21',
    });
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByText(t('budget.overBy', { amount: '₦30,000.00' }))).toBeTruthy();
    expect(screen.getByText(t('budget.nearLimit'))).toBeTruthy();
    expect(screen.getByTestId(`budget-bar-${id('Market')}`)).toBeTruthy();
  });

  it('P06-03: envelope banner shows left to plan', async () => {
    const { sync, repo } = await seeded('envelope');
    const s = await repo.load();
    await repo.addTransaction({
      kind: 'income',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.key === 'cat.salary')!.id,
      amount: 200_000_000n,
      date: '2026-10-05',
    });
    const after = await repo.load();
    const budget = budgetForMonth(after, '2026-10');
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-banner')).toHaveTextContent(
      t('budget.leftToPlan', { amount: formatNaira(budget.leftToPlan) }),
      { exact: false },
    );
  });

  it('D8: tracking banner shows Planned X of Y income', async () => {
    const { sync, repo } = await seeded('tracking');
    const s = await repo.load();
    await repo.addTransaction({
      kind: 'income',
      accountId: s.accounts[0]!.id,
      categoryId: s.categories.find((c) => c.key === 'cat.salary')!.id,
      amount: 200_000_000n,
      date: '2026-10-05',
    });
    const after = await repo.load();
    const planned = [...after.assigns.values()].reduce((a, b) => a + b, 0n);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-banner')).toHaveTextContent(
      t('budget.trackingBanner', { planned: formatNaira(planned), income: formatNaira(200_000_000n) }),
      { exact: false },
    );
  });

  it('D9/D18: summary column with ring on wide layout', async () => {
    const { sync } = await seeded('envelope');
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-summary-column')).toBeTruthy();
    expect(screen.getByTestId('budget-summary-left-to-plan')).toBeTruthy();
  });

  it('D10: groups collapse and show totals', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId(`budget-row-${id('Market')}`)).toBeTruthy();
    expect(screen.getByTestId('budget-group-total-group.food')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('budget-group-toggle-group.food'));
    expect(screen.queryByTestId(`budget-row-${id('Market')}`)).toBeNull();
  });

  it('P06-06 / PU08: Move money from a category with available', async () => {
    const { sync, repo, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-move'));
    expect(screen.getByTestId('budget-move-sheet')).toBeTruthy();
    // Fuel has available; Market is overspent so it is not a From option.
    await fireEvent(screen.getByTestId('budget-move-from'), 'onChange', id('Fuel'));
    await fireEvent(screen.getByTestId('budget-move-to'), 'onChange', id('Market'));
    await fireEvent.changeText(screen.getByTestId('budget-move-amount'), '10000');
    expect(screen.getByTestId('budget-move-preview')).toHaveTextContent('Fuel', { exact: false });
    expect(screen.getByTestId('budget-move-preview')).toHaveTextContent('Market', { exact: false });
    await fireEvent.press(screen.getByTestId('budget-move-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(repo.assigned(id('Fuel'), '2026-10', after)).toBe(59_000_000n);
      expect(repo.assigned(id('Market'), '2026-10', after)).toBe(91_000_000n);
    });
  });

  it('P06-07 / PU10: Cover overspending lists each overspent category', async () => {
    const { sync, repo, id } = await seeded();
    const after = await repo.load();
    expect(overspentCategories(after, '2026-10').map((o) => o.category.name)).toEqual(['Market']);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-cover'));
    expect(screen.getByTestId(`cover-row-${id('Market')}`)).toHaveTextContent(
      t('budget.coverRowOver', { name: 'Market', amount: '₦30,000.00' }),
      { exact: false },
    );
    await fireEvent.press(screen.getByTestId('budget-cover-save'));
    await waitFor(async () => expect(repo.assigned(id('Market'), '2026-10', await repo.load())).toBe(93_000_000n));
  });

  it('tapping a category name opens its Category page', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`budget-name-${id('Market')}`));
    expect(router.push).toHaveBeenCalledWith(`/budget/category/${id('Market')}`);
  });

  it('TB02-2: 3-month control is not offered below 1024', async () => {
    mockWidth = 800;
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(screen.queryByTestId('budget-month-span')).toBeNull();
  });

  it('TB02-1: grouping by Type keeps categories', async () => {
    const { sync, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent(screen.getByTestId('budget-group-by'), 'onChange', 'type');
    expect(await screen.findByTestId(`budget-row-${id('Market')}`)).toBeTruthy();
    expect(screen.getByTestId(`budget-row-${id('Fuel')}`)).toBeTruthy();
  });
});

describe('Category page', () => {
  it('P07-01: Planned, Spent, Remaining and 6-month average', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('Market') });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('category-planned')).toHaveTextContent('₦900,000.00', { exact: false });
    expect(screen.getByTestId('category-spent')).toHaveTextContent('₦930,000.00', { exact: false });
    expect(screen.getByTestId('category-remaining')).toHaveTextContent('−₦30,000.00', { exact: false });
    expect(screen.getByTestId('category-avg')).toBeTruthy();
  });

  it('P07-02: 12-month chart is present with View as table', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('Market') });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('category-chart')).toBeTruthy();
    expect(screen.getByRole('switch', { name: t('chart.viewAsTable') })).toBeTruthy();
  });

  it('P07-05 / PU11: Edit category renames and can hide from budget', async () => {
    const { sync, repo, id } = await seeded();
    setParams({ id: id('Market') });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('category-edit'));
    await fireEvent.changeText(screen.getByTestId('category-edit-name'), 'Groceries');
    await fireEvent.press(screen.getByTestId('category-edit-hide'));
    await fireEvent.press(screen.getByTestId('category-edit-save'));
    await waitFor(async () => {
      const cat = (await repo.load()).categories.find((c) => c.id === id('Market'));
      expect(cat?.name).toBe('Groceries');
      expect(cat?.hidden).toBe(true);
    });
  });

  it('PU11-1: duplicate name in the same group is refused', async () => {
    const { sync, id } = await seeded();
    setParams({ id: id('Market') });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('category-edit'));
    await fireEvent(screen.getByTestId('category-edit-group'), 'onChange', 'group.gettingAround');
    await fireEvent.changeText(screen.getByTestId('category-edit-name'), 'Fuel');
    expect(screen.getByText(t('category.duplicateName', { name: 'Fuel' }))).toBeTruthy();
    expect(screen.getByTestId('category-edit-save')).toBeDisabled();
  });

  it('P06-10 / PU09: templates preview fills and apply', async () => {
    const { sync, repo, id } = await seeded();
    await repo.saveBudgetTemplate('Monthly plan', [
      { categoryId: id('Market'), amountMinor: '40000000', ruleKind: 'monthly' },
      { categoryId: id('Fuel'), amountMinor: '30000000', ruleKind: 'monthly' },
    ]);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-templates'));
    expect(screen.getByTestId('budget-templates-sheet')).toBeTruthy();
    expect(await screen.findByTestId(`budget-templates-fill-${id('Market')}`)).toBeTruthy();
    expect(screen.getByTestId('budget-templates-total')).toBeTruthy();
    await fireEvent(screen.getByTestId('budget-templates-replace'), 'onChange', true);
    await fireEvent.press(screen.getByTestId('budget-templates-apply'));
    await waitFor(async () => {
      expect((await repo.load()).assigns.get(`${id('Market')}:2026-10`)).toBe(40_000_000n);
    });
  });

  it('P06-11: budget ⋯ menu and 1|3 month (DESIGN page 6)', async () => {
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(screen.getByTestId('budget-month-span')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('budget-more-menu'));
    expect(screen.getByTestId('budget-menu-popover')).toBeTruthy();
  });

  it('P07-04: Connected lists templates and plan note', async () => {
    const { sync, repo, id } = await seeded();
    await repo.saveBudgetTemplate('Basics', [{ categoryId: id('Market'), amountMinor: '50000000', ruleKind: 'monthly' }]);
    await repo.setAssigned(id('Market'), '2026-10', 90_000_000n, { note: 'Keep weekly shop under control' });
    setParams({ id: id('Market') });
    await renderWithProviders(wrap(<CategoryScreen />), { sync });
    expect(await screen.findByTestId('category-connected')).toBeTruthy();
    expect(screen.getByTestId('category-template-row')).toBeTruthy();
    expect(screen.getByTestId('category-plan-note')).toHaveTextContent('Keep weekly shop under control', { exact: false });
  });

  it('P06-12: Edit amount template quick pick; carry switch when already on (PU-07)', async () => {
    const { sync, repo, id } = await seeded();
    await repo.saveBudgetTemplate('Basics', [{ categoryId: id('Market'), amountMinor: '40000000', ruleKind: 'monthly' }]);
    // Tracking: carry switch only when already on — enable first, then toggle off in the sheet.
    const before = await repo.load();
    const market = before.categories.find((c) => c.id === id('Market'))!;
    await repo.updateCategory({ ...market, carryOver: true });
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`budget-planned-${id('Market')}`));
    await fireEvent.press(await screen.findByTestId('budget-edit-template-pick'));
    expect(screen.getByTestId('budget-edit-carry')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('budget-edit-carry'));
    await fireEvent.press(screen.getByTestId('budget-edit-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(repo.assigned(id('Market'), '2026-10', after)).toBe(40_000_000n);
      expect(after.categories.find((c) => c.id === id('Market'))?.carryOver).toBe(false);
    });
  });

  it('D21: tablet landscape enables 3-month control', async () => {
    mockWidth = 900;
    mockHeight = 600;
    const { sync } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    expect(await screen.findByTestId('budget-month-span')).toBeTruthy();
    expect(screen.getByTestId('budget-summary-column')).toBeTruthy();
  });
});
