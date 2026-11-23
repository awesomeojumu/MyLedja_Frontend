import {
  defaultDraft,
  frameworkOf,
  goalMonthly,
  lineAmounts,
  monthsUntil,
  pillarAmounts,
  planLines,
  summarize,
  totalPercent,
  type SetupDraft,
} from '../plan';
import { savedFramework } from '../finishSetup';

const base = (): SetupDraft => ({
  ...defaultDraft('Personal', ['exp-housing', 'exp-food', 'exp-entertainment', 'exp-savings-investments'], ['inc-employment'], {}),
  takeHome: '50000000', // ₦500,000
  frameworkId: 'classic_50_30_20',
});

describe('Welcome money plan', () => {
  it('splits take-home by the structure and the parts add up', () => {
    const fw = frameworkOf(base());
    expect(totalPercent(fw)).toBe(100);
    const parts = pillarAmounts(fw, 50000000n);
    expect(parts.get('needs')).toBe(25000000n);
    expect(parts.get('wants')).toBe(15000000n);
    expect(parts.get('savings')).toBe(10000000n);
    expect([...parts.values()].reduce((s, v) => s + v, 0n)).toBe(50000000n);
  });

  it('uses the person’s percentages', () => {
    const fw = frameworkOf({ frameworkId: 'classic_50_30_20', percents: { needs: 60, wants: 20 } });
    expect(fw.pillars.map((p) => p.percentage)).toEqual([60, 20, 20]);
  });

  it('never offers savings and investments as spending', () => {
    expect(planLines(base()).map((l) => l.key)).not.toContain('exp-savings-investments');
  });

  it('places categories under the pillar the structure maps them to, or where the person moved them', () => {
    const lines = planLines({ ...base(), pillarOf: { 'exp-food': 'wants' } });
    expect(lines.find((l) => l.key === 'exp-housing')?.pillarId).toBe('needs');
    expect(lines.find((l) => l.key === 'exp-food')?.pillarId).toBe('wants');
  });

  it('covers bills first, then shares the rest of the pillar equally', () => {
    const draft: SetupDraft = {
      ...base(),
      expenseIds: ['exp-housing', 'exp-food'],
      bills: [{ id: 'b1', name: 'Rent', amount: '15000000', day: 1, categoryKey: 'exp-housing:rent', accountId: 'a1' }],
    };
    const amounts = lineAmounts(draft);
    // Needs ₦250,000: Rent ₦150,000 first, then ₦100,000 shared by Housing and Food.
    expect(amounts.get('exp-housing')).toBe(15000000n + 5000000n);
    expect(amounts.get('exp-food')).toBe(5000000n);
  });

  it('counts monthly debt repayments as bills under Financial Obligations', () => {
    const draft: SetupDraft = {
      ...base(),
      expenseIds: ['exp-housing', 'exp-financial'],
      debts: [{ id: 'd', name: 'Loan', kind: 'bankLoan', amount: '20000000', monthly: '2500000', day: 1 }],
    };
    expect(summarize(draft).billsTotal).toBe(2500000n);
    // Financial Obligations covers the ₦25,000 repayment before the rest of Needs is shared.
    expect(lineAmounts(draft).get('exp-financial')).toBe(2500000n + 11250000n);
  });

  it('keeps an amount the person typed', () => {
    const amounts = lineAmounts({ ...base(), expenseIds: ['exp-housing', 'exp-food'], amounts: { 'exp-food': '8000000' } });
    expect(amounts.get('exp-food')).toBe(8000000n);
    expect(amounts.get('exp-housing')).toBe(17000000n);
  });

  it('works out goal contributions', () => {
    const from = new Date(2026, 10, 23);
    expect(monthsUntil('2027-11-01', from)).toBe(12);
    expect(goalMonthly({ target: '120000000', saved: '0', date: '2027-11-01' }, from)).toBe(10000000n);
    expect(goalMonthly({ target: '100', saved: '100', date: '' }, from)).toBe(0n);
  });

  it('summarizes what is left to plan', () => {
    const from = new Date(2026, 10, 23);
    const s = summarize(
      {
        ...base(),
        goals: [{ id: 'g', kind: 'emergency', name: 'Emergency', target: '120000000', saved: '0', date: '2027-11-01', accountId: 'a' }],
      },
      from,
    );
    expect(s.spendingPlanned).toBe(40000000n);
    expect(s.goalsMonthly).toBe(10000000n);
    expect(s.leftToPlan).toBe(0n);
  });
});

describe('saved structure', () => {
  it('puts each spending category in exactly one pillar', () => {
    const fw = savedFramework({
      ...defaultDraft('P', ['exp-housing', 'exp-spiritual'], ['inc-employment'], {}),
      frameworkId: 'classic_50_30_20',
    });
    const homes = fw.pillars.filter((p) => p.mappedExpenseCategories.includes('Spiritual & Religious'));
    expect(homes).toHaveLength(1);
  });
});
