import { costOfPurchase, unrealisedGain } from '@/ledger';

import { previousPeriod } from '@/features/cashflow/RangeBar';
import { shareHasNaira } from '@/features/health/healthSheets';
import { fifoCost, rangeStart } from '@/features/investments/helpers';

describe('investments formulas (cases 15–17)', () => {
  it('PU38 / case 15: buy 500 @ 210 + 500 fees = 105500', () => {
    expect(costOfPurchase('500', 21000n, 50000n)).toBe(10550000n);
  });

  it('PU40 / case 16: unrealised at 236 is 12500', () => {
    const cost = 10550000n;
    expect(unrealisedGain('500', 23600n, cost)).toBe(1250000n);
  });

  it('PU38 / case 17: sell 200 @ 240 proceeds 48000 gain 5800', () => {
    const proceeds = costOfPurchase('200', 24000n, 0n);
    expect(proceeds).toBe(4800000n);
    const costOfLots = (10550000n * 200n) / 500n;
    expect(costOfLots).toBe(4220000n);
    expect(proceeds - costOfLots).toBe(580000n);
  });

  it('TB08-1: rangeStart changes without touching holdings list contract', () => {
    expect(rangeStart('1Y', '2026-10-28')).toBe('2025-10-28');
    expect(rangeStart('All', '2026-10-28')).toBeNull();
  });
});

describe('TB-14 ranges', () => {
  it('TB14-2: compare to previous period of same length', () => {
    expect(previousPeriod({ from: '2026-10-01', to: '2026-10-31' })).toEqual({
      from: '2026-08-31',
      to: '2026-09-30',
    });
  });
});

describe('PU-45 share', () => {
  it('PU45-1: hide amounts has no naira', () => {
    expect(shareHasNaira('MyLedja Health · Strong · 2026-10')).toBe(false);
    expect(shareHasNaira('Score ₦12,000')).toBe(true);
  });
});

describe('fifo helper shape', () => {
  it('refuses selling with no lots', () => {
    const snapshot = {
      lots: [],
      holdings: [],
      prices: [],
      events: [],
      accounts: [],
      categories: [],
      payees: [],
      rules: [],
    } as never;
    expect(fifoCost(snapshot, 'h1', 1).ok).toBe(false);
  });
});
