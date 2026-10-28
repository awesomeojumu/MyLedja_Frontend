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

  it('P06-06: Move money sheet previews both new planned amounts', async () => {
    const { sync, repo, id } = await seeded();
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-move'));
    expect(screen.getByTestId('budget-move-sheet')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('budget-move-amount'), '10000');
    expect(screen.getByTestId('budget-move-preview')).toHaveTextContent(t('budget.movePreviewFrom', { amount: '₦890,000.00' }), {
      exact: false,
    });
    expect(screen.getByTestId('budget-move-preview')).toHaveTextContent(t('budget.movePreviewTo', { amount: '₦610,000.00' }), {
      exact: false,
    });
    await fireEvent.press(screen.getByTestId('budget-move-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(repo.assigned(id('Market'), '2026-10', after)).toBe(89_000_000n);
      expect(repo.assigned(id('Fuel'), '2026-10', after)).toBe(61_000_000n);
    });
  });

  it('P06-07: Cover overspending lists each overspent category', async () => {
    const { sync, repo, id } = await seeded();
    const after = await repo.load();
    expect(overspentCategories(after, '2026-10').map((o) => o.category.name)).toEqual(['Market']);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-cover'));
    expect(screen.getByTestId(`cover-row-${id('Market')}`)).toHaveTextContent(
      t('budget.coverRow', { name: 'Market', amount: '₦30,000.00' }),
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

  it('P07-05: Edit category renames and can hide from budget', async () => {
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

  it('P06-10: templates preview and apply', async () => {
    const { sync, repo, id } = await seeded();
    const tpl = await repo.saveBudgetTemplate('Monthly basics', [
      { categoryId: id('Market'), amountMinor: '40000000' },
      { categoryId: id('Fuel'), amountMinor: '30000000' },
    ]);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId('budget-templates'));
    expect(screen.getByTestId('budget-templates-sheet')).toBeTruthy();
    await fireEvent(screen.getByTestId('budget-templates-pick'), 'onChange', tpl.id);
    expect(await screen.findByTestId('budget-templates-preview')).toBeTruthy();
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

  it('P06-12: Edit amount carry-over and template quick pick', async () => {
    const { sync, repo, id } = await seeded();
    await repo.saveBudgetTemplate('Basics', [{ categoryId: id('Market'), amountMinor: '40000000', ruleKind: 'monthly' }]);
    await renderWithProviders(wrap(<BudgetScreen />), { sync });
    await fireEvent.press(await screen.findByTestId(`budget-planned-${id('Market')}`));
    await fireEvent.press(await screen.findByTestId('budget-edit-template-pick'));
    await fireEvent.press(screen.getByTestId('budget-edit-carry'));
    await fireEvent.press(screen.getByTestId('budget-edit-save'));
    await waitFor(async () => {
      const after = await repo.load();
      expect(repo.assigned(id('Market'), '2026-10', after)).toBe(40_000_000n);
      expect(after.categories.find((c) => c.id === id('Market'))?.carryOver).toBe(true);
    });
  });
});
