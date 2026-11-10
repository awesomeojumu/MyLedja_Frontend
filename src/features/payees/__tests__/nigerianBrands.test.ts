import { identifyNigerianBrand, suggestCategoryForBrand } from '../nigerianBrands';
import type { Category } from '@/data/workspace/model';

describe('Nigerian Brands Library & Auto-Enrichment', () => {
  const categories: Category[] = [
    { id: 'cat-groceries', name: 'Groceries', kind: 'expense' },
    { id: 'cat-dining', name: 'Dining Out', kind: 'expense' },
    { id: 'cat-transport', name: 'Transport & Fuel', kind: 'expense' },
    { id: 'cat-utilities', name: 'Utilities & Bills', kind: 'expense' },
    { id: 'cat-entertainment', name: 'Entertainment', kind: 'expense' },
  ] as unknown as Category[];

  it('identifies top Nigerian retail, dining, transport, and telco brands', () => {
    const shoprite = identifyNigerianBrand('POS/SHOPRITE MALL LEKKI');
    expect(shoprite).not.toBeNull();
    expect(shoprite?.brand.id).toBe('shoprite');

    const chickenRep = identifyNigerianBrand('Chicken Republic Yaba');
    expect(chickenRep).not.toBeNull();
    expect(chickenRep?.brand.id).toBe('chicken_republic');

    const totalEnergies = identifyNigerianBrand('TOTAL FILLING STATION');
    expect(totalEnergies).not.toBeNull();
    expect(totalEnergies?.brand.id).toBe('totalenergies');

    const mtn = identifyNigerianBrand('MTN VTU 0803');
    expect(mtn).not.toBeNull();
    expect(mtn?.brand.id).toBe('mtn');

    const bolt = identifyNigerianBrand('BOLT *TRIP LAGOS');
    expect(bolt).not.toBeNull();
    expect(bolt?.brand.id).toBe('bolt');
  });

  it('suggests appropriate workspace category for matched brands', () => {
    const shoprite = identifyNigerianBrand('Shoprite')!;
    const catShoprite = suggestCategoryForBrand(shoprite.brand, categories);
    expect(catShoprite?.id).toBe('cat-groceries');

    const chickenRep = identifyNigerianBrand('Chicken Republic')!;
    const catChicken = suggestCategoryForBrand(chickenRep.brand, categories);
    expect(catChicken?.id).toBe('cat-dining');

    const total = identifyNigerianBrand('TotalEnergies')!;
    const catTotal = suggestCategoryForBrand(total.brand, categories);
    expect(catTotal?.id).toBe('cat-transport');
  });
});
