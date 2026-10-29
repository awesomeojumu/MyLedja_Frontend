import { suggestedFirstBudget } from '../suggestedBudget';

describe('suggestedFirstBudget', () => {
  const cats = [
    { id: 'rent', key: 'cat.rent', kind: 'expense', countInBudget: true },
    { id: 'fuel', key: 'cat.fuel', kind: 'expense', countInBudget: true },
    { id: 'salary', key: 'cat.salary', kind: 'income', countInBudget: true },
  ];

  it('returns empty when take-home is null or zero', () => {
    expect(suggestedFirstBudget(null, cats)).toEqual([]);
    expect(suggestedFirstBudget(0n, cats)).toEqual([]);
  });

  it('splits take-home across expense categories and totals the amount', () => {
    const lines = suggestedFirstBudget(1_000_000_00n, cats);
    expect(lines.every((l) => l.categoryId !== 'salary')).toBe(true);
    expect(lines.reduce((s, l) => s + l.amountMinor, 0n)).toBe(1_000_000_00n);
    expect(lines.find((l) => l.categoryId === 'rent')!.amountMinor).toBeGreaterThan(
      lines.find((l) => l.categoryId === 'fuel')!.amountMinor,
    );
  });
});
