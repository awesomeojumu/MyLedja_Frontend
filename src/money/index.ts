/** Amounts are whole minor units (kobo) held as bigint. Never use floating point here. */

export type ParseResult = { ok: true; minor: bigint } | { ok: false; error: 'amount_unreadable' };

const AMOUNT_PATTERN = /^-?(\d{1,3}(,\d{3})+|\d+)(\.\d{1,2})?$/;

/** Reads what a person types ("18450", "18,450.5") into kobo. "1,2,3" is refused. */
export function parseAmount(input: string): ParseResult {
  const text = input.trim().replace(/^₦/, '');
  if (!AMOUNT_PATTERN.test(text)) return { ok: false, error: 'amount_unreadable' };
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = text.replace('-', '').replace(/,/g, '').split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return { ok: true, minor: negative ? -minor : minor };
}

/** Amounts travel in JSON as strings of minor units. */
export function fromWire(value: string): bigint {
  if (!/^-?\d+$/.test(value)) throw new Error('amount_not_minor_units');
  return BigInt(value);
}

export function toWire(minor: bigint): string {
  return minor.toString();
}

/** Kobo as text for an amount field to start from: 1845050n is "18450.50", 1845000n is "18450". Reads back with parseAmount. */
export function toInputText(minor: bigint): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const kobo = abs % 100n;
  const text = kobo === 0n ? `${abs / 100n}` : `${abs / 100n}.${kobo.toString().padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export type FormatOptions = {
  /** Headline tiles may drop ".00" when the kobo are zero (DESIGN.md 2.6). */
  dropZeroKobo?: boolean;
  /** Show "+" on money in. */
  signed?: boolean;
};

export const MINUS = '\u2212';

/** ₦1,284,560.50; −₦18,450.00; never rounded. */
export function formatNaira(minor: bigint, options: FormatOptions = {}): string {
  const negative = minor < 0n;
  const abs = negative ? -minor : minor;
  const whole = groupThousands((abs / 100n).toString());
  const kobo = (abs % 100n).toString().padStart(2, '0');
  const body = options.dropZeroKobo && kobo === '00' ? whole : `${whole}.${kobo}`;
  const sign = negative ? MINUS : options.signed && minor > 0n ? '+' : '';
  return `${sign}₦${body}`;
}

const SYMBOLS: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };

/** An amount in its own currency: its symbol (or code) before the figure (DESIGN.md 2.6). Two decimals. */
export function formatMoney(minor: bigint, currency = 'NGN', options: FormatOptions = {}): string {
  if (currency === 'NGN') return formatNaira(minor, options);
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return formatNaira(minor, options).replace('₦', symbol);
}

/** Exported statements use brackets for negatives. */
export function formatNairaStatement(minor: bigint): string {
  return minor < 0n ? `(${formatNaira(-minor)})` : formatNaira(minor);
}

export const PRIVACY_MASK = '₦ •••••';

/** Round a ratio to minor units, half away from zero (TECH-SPEC 6.5). */
export function roundHalfAwayFromZero(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error('division_by_zero');
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const q = n / d;
  const r = n % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return negative ? -rounded : rounded;
}

/** Split by weights; leftover kobo go to the largest part so the parts add up exactly. */
export function splitByWeights(total: bigint, weights: bigint[]): bigint[] {
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (weights.length === 0 || sum === 0n) throw new Error('no_weights');
  const parts = weights.map((w) => roundHalfAwayFromZero(total * w, sum));
  const leftover = total - parts.reduce((a, b) => a + b, 0n);
  let largest = 0;
  parts.forEach((p, i) => {
    const current = parts[largest] ?? 0n;
    if ((p < 0n ? -p : p) > (current < 0n ? -current : current)) largest = i;
  });
  parts[largest] = (parts[largest] ?? 0n) + leftover;
  return parts;
}
