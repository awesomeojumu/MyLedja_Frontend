// Kept the same as MyLedja_Backend's copy (currencies.service converterOf, money convert): change both together.

/** Minor units per currency: kobo, cents, none for yen (TECH-SPEC 6.5). */
const EXPONENT: Readonly<Record<string, number>> = { NGN: 2, USD: 2, GBP: 2, EUR: 2, JPY: 0 };
const exponentOf = (currency: string) => EXPONENT[currency] ?? 2;

const RATE = /^(0|[1-9]\d*)(?:\.(\d{1,10}))?$/;

/** A readable rate: up to 12 whole digits and 10 decimal places, above zero. */
export const isRate = (rate: string) => RATE.test(rate) && /[1-9]/.test(rate);

function divRoundHalfEven(n: bigint, d: bigint): bigint {
  const q = n / d;
  const r = n % d;
  const twice = 2n * (r < 0n ? -r : r);
  if (twice > d || (twice === d && q % 2n !== 0n)) return n < 0n ? q - 1n : q + 1n;
  return q;
}

/** One balance at a rate (home currency per one unit of `from`), rounded half to even (TECH-SPEC 6.5). */
export function convert(amount: bigint, from: string, to: string, rate: string): bigint {
  const m = RATE.exec(rate);
  if (!m) throw new Error('rate_unreadable');
  const frac = m[2] ?? '';
  const scaled = BigInt(m[1]! + frac);
  const shift = exponentOf(to) - exponentOf(from);
  const num = amount * scaled * (shift >= 0 ? 10n ** BigInt(shift) : 1n);
  const den = 10n ** BigInt(frac.length) * (shift < 0 ? 10n ** BigInt(-shift) : 1n);
  return divRoundHalfEven(num, den);
}

/** Converts into the home currency on a date, or null with no rate (the figure is then "Partial"). */
export type Converter = (amount: bigint, from: string, date: string) => bigint | null;

/** The rate for a date is the latest one entered on or before it (TECH-SPEC 6.7, case 25). */
export function converterOf(rates: readonly { currency: string; date: string; rate: string }[], home: string): Converter {
  const byCurrency = new Map<string, { date: string; rate: string }[]>();
  for (const r of rates) {
    const list = byCurrency.get(r.currency) ?? [];
    list.push(r);
    byCurrency.set(r.currency, list);
  }
  for (const list of byCurrency.values()) list.sort((a, b) => a.date.localeCompare(b.date));
  return (amount, from, date) => {
    if (from === home) return amount;
    const list = byCurrency.get(from);
    if (!list) return null;
    let best: string | null = null;
    for (const r of list) {
      if (r.date > date) break;
      best = r.rate;
    }
    return best === null ? null : convert(amount, from, home, best);
  };
}
