import { openKeyValue } from '../../data/kv';

export interface RecurringBillItem {
  id: string;
  name: string;
  amountMinor: bigint;
  dueDay: number;
  cadence: 'monthly' | 'quarterly' | 'annual';
  category: string;
  subcategory?: string;
  paid?: boolean;
}

export const STORAGE_KEY_RECURRING_BILLS = 'pref:recurring_bills_v2';

export const DEFAULT_RECURRING_BILLS: RecurringBillItem[] = [
  {
    id: 'bill-mtn-home',
    name: 'MTN Home Data Subscription',
    amountMinor: 3000000n, // ₦30,000 / month
    dueDay: 1,
    cadence: 'monthly',
    category: 'Communication & Technology',
    subcategory: 'Internet subscriptions',
    paid: true,
  },
  {
    id: 'bill-ikeja-electric',
    name: 'Ikeja Electric Prepaid Token',
    amountMinor: 2500000n, // ₦25,000 / month
    dueDay: 5,
    cadence: 'monthly',
    category: 'Utilities',
    subcategory: 'Electricity',
    paid: true,
  },
  {
    id: 'bill-apple-cloud',
    name: 'Apple Cloud Space',
    amountMinor: 1500000n, // ₦15,000 / month
    dueDay: 12,
    cadence: 'monthly',
    category: 'Communication & Technology',
    subcategory: 'Cloud storage',
    paid: false,
  },
  {
    id: 'bill-mtn-personal-quarterly',
    name: 'MTN Personal Data (Quarterly)',
    amountMinor: 4500000n, // ₦45,000 / quarter
    dueDay: 15,
    cadence: 'quarterly',
    category: 'Communication & Technology',
    subcategory: 'Data',
    paid: false,
  },
  {
    id: 'bill-estate-security',
    name: 'Estate Security & Maintenance Levy',
    amountMinor: 1500000n, // ₦15,000 / month
    dueDay: 28,
    cadence: 'monthly',
    category: 'Housing',
    subcategory: 'Security',
    paid: false,
  },
];

/** Convert recurring bill cadence to monthly commitment weight */
export function getMonthlyEquivalentMinor(bill: RecurringBillItem): bigint {
  switch (bill.cadence) {
    case 'annual':
      return bill.amountMinor / 12n;
    case 'quarterly':
      return bill.amountMinor / 3n;
    case 'monthly':
    default:
      return bill.amountMinor;
  }
}

/** Load bills from persistent KV storage or fallback to defaults */
export async function loadBillsFromStorage(): Promise<RecurringBillItem[]> {
  try {
    const kv = openKeyValue('myledja');
    const stored = await kv.get(STORAGE_KEY_RECURRING_BILLS);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          id: item.id,
          name: item.name,
          amountMinor: BigInt(item.amountMinor || '0'),
          dueDay: Number(item.dueDay) || 1,
          cadence: item.cadence || 'monthly',
          category: item.category || 'Utilities',
          subcategory: item.subcategory || undefined,
          paid: Boolean(item.paid),
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to load recurring bills from KV', err);
  }
  return DEFAULT_RECURRING_BILLS;
}

/** Save bills to persistent KV storage */
export async function saveBillsToStorage(bills: RecurringBillItem[]): Promise<void> {
  try {
    const kv = openKeyValue('myledja');
    const serializable = bills.map((b) => ({
      id: b.id,
      name: b.name,
      amountMinor: b.amountMinor.toString(),
      dueDay: b.dueDay,
      cadence: b.cadence,
      category: b.category,
      subcategory: b.subcategory,
      paid: Boolean(b.paid),
    }));
    await kv.set([[STORAGE_KEY_RECURRING_BILLS, JSON.stringify(serializable)]]);
  } catch (err) {
    console.warn('Failed to save recurring bills to KV', err);
  }
}
