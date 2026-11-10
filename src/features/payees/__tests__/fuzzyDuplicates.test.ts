import { cleanNigerianMerchantName, findFuzzyDuplicates, normalizeMerchantName } from '../fuzzyDuplicates';
import type { Payee } from '@/data/workspace/model';

describe('fuzzyDuplicates & Nigerian clean-up', () => {
  it('cleans raw POS and Web prefixes, terminal suffixes, and locations', () => {
    expect(cleanNigerianMerchantName('POS/SHOPRITE LEKKI LA NG').cleaned).toBe('Shoprite Lekki');
    expect(cleanNigerianMerchantName('WEB/PAYSTACK/UBER *TRIP 1492').cleaned).toBe('Uber *trip 1492');
    expect(cleanNigerianMerchantName('TRF/MONIEPOINT/CHICKEN REP LOS NG').cleaned).toBe('Chicken Rep');
    expect(cleanNigerianMerchantName('NIP/OPAY/TOTAL PETROL 992817').cleaned).toBe('Total Petrol');
    expect(cleanNigerianMerchantName('Shoprite Lekki').isDirty).toBe(false);
  });

  it('normalizes merchant names into clean comparison tokens', () => {
    expect(normalizeMerchantName('POS/SHOPRITE LEKKI LA NG')).toBe('shoprite lekki');
    expect(normalizeMerchantName('Shoprite Lekki Mall')).toBe('shoprite lekki mall');
  });

  it('detects fuzzy duplicate payees across raw variants', () => {
    const payees: Payee[] = [
      { id: 'p1', name: 'Shoprite Lekki' },
      { id: 'p2', name: 'POS/SHOPRITE LEKKI LA NG' },
      { id: 'p3', name: 'MTN Airtime' },
      { id: 'p4', name: 'WEB/MTN VTU 847291' },
      { id: 'p5', name: 'Uber' },
    ];

    const duplicates = findFuzzyDuplicates(payees);
    expect(duplicates.length).toBe(2);
    expect(duplicates.some((d) => d.group.some((p) => p.name === 'Shoprite Lekki'))).toBe(true);
    expect(duplicates.some((d) => d.group.some((p) => p.name === 'MTN Airtime'))).toBe(true);
  });
});
