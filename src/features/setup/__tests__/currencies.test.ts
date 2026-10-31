import { addPreferredCurrency, currencyLabel, filterCurrencies } from '../currencies';

describe('filterCurrencies', () => {
  it('puts naira first and keeps a global list', () => {
    const all = filterCurrencies('');
    expect(all[0]?.code).toBe('NGN');
    expect(all.length).toBeGreaterThan(100);
    expect(all.some((c) => c.code === 'JPY')).toBe(true);
    expect(all.some((c) => c.code === 'GHS')).toBe(true);
  });

  it('matches a name or a code', () => {
    expect(filterCurrencies('cedi').map((c) => c.code)).toEqual(['GHS']);
    expect(filterCurrencies('usd').map((c) => c.code)).toContain('USD');
  });

  it('adds a currency to a preferred list once', () => {
    expect(addPreferredCurrency(['NGN'], 'usd')).toEqual(['NGN', 'USD']);
    expect(addPreferredCurrency(['NGN', 'USD'], 'USD')).toEqual(['NGN', 'USD']);
    expect(addPreferredCurrency(['NGN'], 'XYZ')).toEqual(['NGN']);
  });

  it('labels a code with its name', () => {
    expect(currencyLabel('NGN')).toBe('Nigerian naira (NGN)');
    expect(currencyLabel('XYZ')).toBe('XYZ');
  });
});
