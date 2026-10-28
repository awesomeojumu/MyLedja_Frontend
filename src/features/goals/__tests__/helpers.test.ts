import { monthlyNeeded, goalProgress } from '../helpers';

describe('goal helpers', () => {
  it('P14-01: monthly needed from target and saved', () => {
    expect(goalProgress(620_000_00n, 1_000_000_00n)).toBeCloseTo(0.62, 2);
    const monthly = monthlyNeeded(620_000_00n, 1_000_000_00n, '2026-10-28', '2027-06-01');
    expect(monthly).not.toBeNull();
    expect(monthly!).toBeGreaterThan(0n);
  });
});
