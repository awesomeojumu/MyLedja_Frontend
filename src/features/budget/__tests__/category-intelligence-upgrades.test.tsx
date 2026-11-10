import { fireEvent, waitFor } from '@testing-library/react-native';

import {
  inferCategoryMetadata,
  NIGERIAN_CATEGORY_PRESETS,
} from '../categoryInference';
import { categoryBurnRate, categoryMerchantBreakdown } from '../helpers';
import { EditCategorySheet } from '../CategorySheets';
import type { BudgetRow } from '@/ledger/budget';
import type { Snapshot } from '@/data/workspace/repository';
import { renderWithProviders } from '../../../../test/helpers/render';

describe('Category Inference Engine', () => {
  it('correctly infers metadata from Nigerian & everyday keywords', () => {
    const fuel = inferCategoryMetadata('Generator fuel');
    expect(fuel.icon).toBe('Car');
    expect(fuel.group).toBe('group.gettingAround');
    expect(fuel.essential).toBe(true);
    expect(fuel.budgetType).toBe('flexible');

    const uber = inferCategoryMetadata('Bolt ride to office');
    expect(uber.icon).toBe('Bus');
    expect(uber.group).toBe('group.gettingAround');

    const data = inferCategoryMetadata('MTN monthly data');
    expect(data.icon).toBe('Smartphone');
    expect(data.group).toBe('group.home');
    expect(data.budgetType).toBe('fixed');

    const food = inferCategoryMetadata('Market foodstuff');
    expect(food.icon).toBe('ShoppingBasket');
    expect(food.group).toBe('group.food');

    const tithe = inferCategoryMetadata('Church tithe');
    expect(tithe.icon).toBe('Heart');
    expect(tithe.group).toBe('group.faith');
    expect(tithe.essential).toBe(false);

    const school = inferCategoryMetadata('Kids school tuition');
    expect(school.icon).toBe('Baby');
    expect(school.group).toBe('group.family');
  });

  it('exposes curated Nigerian presets', () => {
    expect(NIGERIAN_CATEGORY_PRESETS.length).toBeGreaterThanOrEqual(5);
    const names = NIGERIAN_CATEGORY_PRESETS.map((p) => p.name);
    expect(names).toContain('Generator and Fuel');
    expect(names).toContain('Estate Levies');
    expect(names).toContain('Data and Airtime');
    expect(names).toContain('Foodstuff and Market');
    expect(names).toContain('Tithe and Giving');
  });
});

describe('Category Burn Rate and Helpers', () => {
  it('computes daily velocity and pacing correctly', () => {
    const row: BudgetRow = {
      carried: 0n,
      assigned: 60000_00n, // 60,000 for the month
      activity: 40000_00n, // 40,000 spent
      available: 20000_00n,
    };

    // Day 10 of 30-day month -> 40,000 in 10 days = 4,000/day vs planned 2,000/day
    const burn = categoryBurnRate(row, '2026-04', '2026-04-10');
    expect(burn.totalDays).toBe(30);
    expect(burn.currentDay).toBe(10);
    expect(burn.dailyBurn).toBe(4000_00n);
    expect(burn.plannedDailyRate).toBe(2000_00n);
    expect(burn.isProjectedEarly).toBe(true);
    expect(burn.limitDay).toBe(15); // Reaches 60,000 limit by day 15
  });

  it('computes top merchants breakdown sorted by spend', () => {
    const snapshot = {
      categories: [{ id: 'cat-food', name: 'Food', group: 'food', kind: 'expense', budgetType: 'flexible', carryOver: false }],
      categoryGroups: [],
      accounts: [],
      events: [
        {
          id: 'e1',
          date: '2026-04-05',
          type: 'expense',
          status: 'posted',
          payeeName: 'Shoprite Supermarket',
          lines: [{ ledgerAccountId: 'cat-food', amountMinor: 25000_00n }],
        },
        {
          id: 'e2',
          date: '2026-04-08',
          type: 'expense',
          status: 'posted',
          payeeName: 'Local Market',
          lines: [{ ledgerAccountId: 'cat-food', amountMinor: 15000_00n }],
        },
        {
          id: 'e3',
          date: '2026-04-12',
          type: 'expense',
          status: 'posted',
          payeeName: 'Shoprite Supermarket',
          lines: [{ ledgerAccountId: 'cat-food', amountMinor: 10000_00n }],
        },
      ],
      recurring: [],
      rules: [],
      assignNotes: new Map(),
      assigned: new Map(),
      goals: [],
      debts: [],
    } as unknown as Snapshot;

    const breakdown = categoryMerchantBreakdown(snapshot, 'cat-food', '2026-04');
    expect(breakdown.length).toBe(2);
    expect(breakdown[0]!.name).toBe('Shoprite Supermarket');
    expect(breakdown[0]!.amount).toBe(35000_00n);
    expect(breakdown[0]!.percentage).toBe(70);
    expect(breakdown[1]!.name).toBe('Local Market');
    expect(breakdown[1]!.amount).toBe(15000_00n);
    expect(breakdown[1]!.percentage).toBe(30);
  });
});

describe('EditCategorySheet Progressive Disclosure', () => {
  const dummySnapshot = {
    categories: [],
    categoryGroups: [{ id: 'group-1', name: 'Home', kind: 'expense' }],
    accounts: [],
    events: [],
    recurring: [],
    rules: [],
    assignNotes: new Map(),
    assigned: new Map(),
    goals: [],
    debts: [],
  } as unknown as Snapshot;

  it('renders progressive disclosure with Tier 1 and expands Tier 2 on toggle', async () => {
    const onSave = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, queryByTestId } = await renderWithProviders(
      <EditCategorySheet
        visible={true}
        category={null}
        snapshot={dummySnapshot}
        isNew={true}
        onClose={onClose}
        onSave={onSave}
      />
    );

    // Tier 1 fields visible
    expect(getByTestId('category-edit-name')).toBeTruthy();
    expect(getByTestId('category-icon-preview')).toBeTruthy();
    expect(getByTestId('category-preset-generator-and-fuel')).toBeTruthy();
    expect(getByTestId('category-toggle-advanced')).toBeTruthy();

    // Select preset pill auto-fills name
    fireEvent.press(getByTestId('category-preset-generator-and-fuel'));
    await waitFor(() => {
      expect(getByTestId('category-edit-name').props.value).toBe('Generator and Fuel');
    });

    // Tier 2 advanced fields collapsed by default
    expect(queryByTestId('category-advanced-tier')).toBeNull();

    // Toggle advanced options accordion
    fireEvent.press(getByTestId('category-toggle-advanced'));
    await waitFor(() => {
      expect(getByTestId('category-advanced-tier')).toBeTruthy();
      expect(getByTestId('category-edit-essential')).toBeTruthy();
      expect(getByTestId('category-edit-hide')).toBeTruthy();
    });
  });
});
