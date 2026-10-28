import { monthlyNeeded, goalProgress, goalStatusKind } from '../helpers';

describe('goal helpers', () => {
  it('P14-01: monthly needed from target and saved', () => {
    expect(goalProgress(620_000_00n, 1_000_000_00n)).toBeCloseTo(0.62, 2);
    const monthly = monthlyNeeded(620_000_00n, 1_000_000_00n, '2026-10-28', '2027-06-01');
    expect(monthly).not.toBeNull();
    expect(monthly!).toBeGreaterThan(0n);
  });

  it('marks goals behind when past target date', () => {
    const card = {
      goal: { id: 'g1', name: 'X', targetMinor: '100000', accountId: 'a1', status: 'active' as const, targetDate: '2026-10-01' },
      saved: 0n,
      target: 100_000n,
      progress: 0,
      monthly: 10_000n,
      accountName: 'Savings',
    };
    expect(goalStatusKind(card, '2026-10-28')).toBe('behind');
  });
});
