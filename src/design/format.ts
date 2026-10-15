/* Money, amount and category helpers shared by every screen. The only place money is formatted. */

const SYMBOLS: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };

/** ₦1,250,450.50: symbol, thousands separators, always two decimals (kobo). Signs use a true minus (U+2212). */
export function formatMoney(value: number, currency: string = 'NGN', opts: { sign?: 'minus' | 'plus' | null } = {}): string {
  const n = Math.abs(Number(value) || 0);
  const [whole, kobo] = n.toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sym = SYMBOLS[currency] ?? currency + ' ';
  const sign = opts.sign === 'minus' ? '−' : opts.sign === 'plus' ? '+' : '';
  return `${sign}${sym}${grouped}.${kobo}`;
}

/** Cleans typed text into a decimal string: digits, one point, max two kobo digits, max 11 naira digits. Never a float. */
export function cleanAmount(text: string): string {
  const v = (text || '').replace(/[^0-9.]/g, '');
  const i = v.indexOf('.');
  const whole = (i < 0 ? v : v.slice(0, i)).replace(/^0+(?=\d)/, '').slice(0, 11);
  return i < 0 ? whole : (whole || '0') + '.' + v.slice(i + 1).replace(/\./g, '').slice(0, 2);
}

/** Decimal string to integer kobo, for storage. */
export function toKobo(value: string): number {
  const [w, k = ''] = (value || '0').split('.');
  return Number(w || 0) * 100 + Number((k + '00').slice(0, 2));
}

export type CategoryTone = 'orange' | 'teal' | 'pink' | 'gold' | 'green' | 'purple' | 'sky' | 'slate' | 'transfer';

export const CATEGORIES: Record<string, [string, CategoryTone]> = {
  'Food & groceries': ['shopping-cart', 'orange'], 'Eating out': ['utensils', 'orange'], 'Transport': ['bus', 'teal'], 'Travel': ['plane', 'teal'],
  'Data & airtime': ['signal', 'sky'], 'Electricity': ['lightbulb', 'gold'], 'Fuel & generator': ['fuel', 'gold'], 'Rent': ['house', 'purple'],
  'Household items': ['sofa', 'purple'], 'Repairs & maintenance': ['wrench', 'purple'], 'Family support': ['users', 'pink'], 'Giving & donations': ['hand-heart', 'pink'],
  'Gifts': ['gift', 'pink'], 'Events & celebrations': ['party-popper', 'pink'], 'School fees': ['graduation-cap', 'sky'], 'Subscriptions (DSTV, Netflix)': ['tv', 'sky'],
  'Phone & gadgets': ['smartphone', 'sky'], 'Health & medical': ['heart-pulse', 'green'], 'Personal care': ['sparkles', 'pink'], 'Clothing': ['shirt', 'orange'],
  'Entertainment': ['clapperboard', 'purple'], 'Bank charges': ['credit-card', 'slate'], 'Loan repayments': ['landmark', 'slate'], 'Business expenses': ['briefcase', 'slate'],
  'Other': ['ellipsis', 'slate'],
  'Salary': ['banknote', 'green'], 'Business income': ['briefcase', 'green'], 'Side hustle': ['laptop', 'green'], 'Gift received': ['gift', 'pink'],
  'Interest & returns': ['trending-up', 'green'], 'Refund': ['rotate-ccw', 'sky'], 'Transfer': ['arrow-left-right', 'transfer'],
};

export const EXPENSE_CATEGORIES = ['Food & groceries', 'Transport', 'Data & airtime', 'Electricity', 'Rent', 'Fuel & generator', 'Eating out', 'Family support', 'School fees', 'Health & medical', 'Giving & donations', 'Clothing', 'Personal care', 'Household items', 'Subscriptions (DSTV, Netflix)', 'Phone & gadgets', 'Repairs & maintenance', 'Bank charges', 'Loan repayments', 'Travel', 'Events & celebrations', 'Gifts', 'Entertainment', 'Business expenses', 'Other'];
export const INCOME_CATEGORIES = ['Salary', 'Business income', 'Side hustle', 'Gift received', 'Interest & returns', 'Refund', 'Other'];

export function categoryInfo(name?: string): [string, CategoryTone] {
  return (name && CATEGORIES[name]) || ['ellipsis', 'slate'];
}

export function compactNaira(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e9) return '₦' + +(n / 1e9).toFixed(2) + 'bn';
  if (a >= 1e6) return '₦' + +(n / 1e6).toFixed(2) + 'm';
  if (a >= 1e3) return '₦' + Math.round(n / 1e3) + 'k';
  return '₦' + n;
}
