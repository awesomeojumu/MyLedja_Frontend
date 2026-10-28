import {
  formatNaira,
  formatNairaStatement,
  fromWire,
  parseAmount,
  roundHalfAwayFromZero,
  splitByWeights,
  toInputText,
  toWire,
} from '..';

describe('parseAmount', () => {
  it('reads 18450 as ₦18,450.00', () => {
    expect(parseAmount('18450')).toEqual({ ok: true, minor: 1845000n });
    expect(formatNaira(1845000n)).toBe('₦18,450.00');
  });
  it('reads grouped and fractional amounts exactly', () => {
    expect(parseAmount('1,284,560.5')).toEqual({ ok: true, minor: 128456050n });
    expect(parseAmount('₦0.01')).toEqual({ ok: true, minor: 1n });
    expect(parseAmount('-25')).toEqual({ ok: true, minor: -2500n });
  });
  it.each(['1,2,3', '', 'abc', '1.234', '12,34', '1e5'])('refuses %p', (input) => {
    expect(parseAmount(input)).toEqual({ ok: false, error: 'amount_unreadable' });
  });
  it('handles amounts beyond Number precision', () => {
    expect(parseAmount('90071992547409931.23')).toEqual({ ok: true, minor: 9007199254740993123n });
  });
});

describe('formatNaira', () => {
  it('shows kobo, grouping and a true minus', () => {
    expect(formatNaira(-1845000n)).toBe('\u2212₦18,450.00');
    expect(formatNaira(5n)).toBe('₦0.05');
    expect(formatNaira(0n)).toBe('₦0.00');
  });
  it('drops zero kobo only when asked', () => {
    expect(formatNaira(81230000n, { dropZeroKobo: true })).toBe('₦812,300');
    expect(formatNaira(81230050n, { dropZeroKobo: true })).toBe('₦812,300.50');
  });
  it('signs money in when asked', () => {
    expect(formatNaira(100n, { signed: true })).toBe('+₦1.00');
  });
  it('uses brackets for statements', () => {
    expect(formatNairaStatement(-1845000n)).toBe('(₦18,450.00)');
    expect(formatNairaStatement(100n)).toBe('₦1.00');
  });
});

describe('wire format', () => {
  it('round-trips strings of minor units', () => {
    expect(fromWire('6000000')).toBe(6000000n);
    expect(toWire(-1n)).toBe('-1');
    expect(() => fromWire('60.00')).toThrow();
  });
});

describe('toInputText', () => {
  it('writes kobo as text that reads back exactly', () => {
    expect(toInputText(1_845_000n)).toBe('18450');
    expect(toInputText(1_845_050n)).toBe('18450.50');
    expect(toInputText(5n)).toBe('0.05');
    expect(toInputText(-1_845_001n)).toBe('-18450.01');
    for (const minor of [0n, 1n, 99n, 100n, 80_000_001n, -250n]) {
      expect(parseAmount(toInputText(minor))).toEqual({ ok: true, minor });
    }
  });
});

describe('rounding (TECH-SPEC 6.5)', () => {
  it('8% of ₦800,000.01 rounds half away from zero', () => {
    expect(roundHalfAwayFromZero(80000001n * 8n, 100n)).toBe(6400000n);
    expect(roundHalfAwayFromZero(-5n, 10n)).toBe(-1n);
    expect(roundHalfAwayFromZero(5n, 10n)).toBe(1n);
    expect(() => roundHalfAwayFromZero(1n, 0n)).toThrow();
  });
  it('₦100.00 split three ways adds up exactly', () => {
    const parts = splitByWeights(10000n, [1n, 1n, 1n]);
    expect(parts.reduce((a, b) => a + b, 0n)).toBe(10000n);
    expect(parts).toEqual([3334n, 3333n, 3333n]);
  });
  it('gives the leftover to the largest part', () => {
    expect(splitByWeights(10n, [1n, 2n])).toEqual([3n, 7n]);
    expect(() => splitByWeights(10n, [])).toThrow();
  });
});
