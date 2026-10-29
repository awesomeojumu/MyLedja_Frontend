import { monthlyNeeded, goalProgress, goalScheduleDue, goalStatusKind, gridColumns } from '../helpers';

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

  it('D10: tablet landscape uses 3 columns', () => {
    expect(gridColumns('tablet', { width: 1100, height: 800 })).toBe(3);
    expect(gridColumns('tablet', { width: 800, height: 1100 })).toBe(2);
    expect(gridColumns('phone')).toBe(1);
  });

  it('PU-33: schedule due on matching day when auto on', () => {
    expect(
      goalScheduleDue(
        { scheduleAutoAllocate: true, scheduleAmountMinor: '1000', scheduleEvery: 'month', scheduleDayOfMonth: 28, scheduleStarts: '2026-10-01' },
        '2026-10-28',
      ),
    ).toBe(true);
    expect(
      goalScheduleDue(
        { scheduleAutoAllocate: true, scheduleAmountMinor: '1000', scheduleEvery: 'month', scheduleDayOfMonth: 28, scheduleStarts: '2026-10-01' },
        '2026-10-27',
      ),
    ).toBe(false);
  });
});
