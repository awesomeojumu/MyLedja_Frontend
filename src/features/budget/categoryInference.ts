import type { BudgetType } from '@/data/workspace/model';

export type CategoryInferenceResult = {
  icon: string;
  group: string;
  budgetType: BudgetType;
  essential: boolean;
};

export const NIGERIAN_CATEGORY_PRESETS = [
  { name: 'Generator and Fuel', group: 'group.gettingAround', budgetType: 'flexible' as const, icon: 'Car', essential: true },
  { name: 'Estate Levies', group: 'group.home', budgetType: 'fixed' as const, icon: 'Home', essential: true },
  { name: 'Data and Airtime', group: 'group.home', budgetType: 'fixed' as const, icon: 'Smartphone', essential: true },
  { name: 'Foodstuff and Market', group: 'group.food', budgetType: 'flexible' as const, icon: 'ShoppingBasket', essential: true },
  { name: 'Tithe and Giving', group: 'group.faith', budgetType: 'flexible' as const, icon: 'Heart', essential: false },
];

/**
 * Smart Keyword-to-Metadata Inference Engine.
 * Infers icon, parent group, budget type, and essential flag from category name keywords.
 */
export function inferCategoryMetadata(name: string): CategoryInferenceResult {
  const n = name.trim().toLowerCase();

  // 1. Fuel / Generator / Petrol
  if (/fuel|petrol|generator|diesel|gas|oando|total|conoil|mobil|fueling/.test(n)) {
    return { icon: 'Car', group: 'group.gettingAround', budgetType: 'flexible', essential: true };
  }

  // 2. Transport / Ride / Transit
  if (/uber|bolt|danfo|transport|brt|ride|taxi|korope|flight|fare|okada|bus/.test(n)) {
    return { icon: 'Bus', group: 'group.gettingAround', budgetType: 'flexible', essential: true };
  }

  // 3. Streaming / TV / Subscriptions
  if (/dstv|gotv|netflix|spotify|apple|youtube|showmax|prime|cable|startimes/.test(n)) {
    return { icon: 'Smartphone', group: 'group.home', budgetType: 'fixed', essential: false };
  }

  // 4. Tithe / Giving / Faith
  if (/tithe|offering|church|mosque|zakat|donation|charity|giving|firstfruit/.test(n)) {
    return { icon: 'Heart', group: 'group.faith', budgetType: 'flexible', essential: false };
  }

  // 5. Airtime / Data / Internet
  if (/airtime|data|mtn|airtel|glo|9mobile|internet|wifi|spectranet|smile|ipnx/.test(n)) {
    return { icon: 'Smartphone', group: 'group.home', budgetType: 'fixed', essential: true };
  }

  // 6. Food / Groceries / Market
  if (/market|grocer|food|eat\s*out|shawarma|restaurant|lunch|dinner|breakfast|foodstuff|bread|provisions|supermarket|shoprite|spar/.test(n)) {
    return { icon: 'ShoppingBasket', group: 'group.food', budgetType: 'flexible', essential: true };
  }

  // 7. Housing / Rent / Electricity / Utilities
  if (/rent|estate|service\s*charge|waste|lawma|nepa|phcn|electricity|water|utility|security/.test(n)) {
    return { icon: 'Home', group: 'group.home', budgetType: 'fixed', essential: true };
  }

  // 8. Family / Children / Education
  if (/school|tuition|creche|daycare|books|uniform|kids|baby|lesson/.test(n)) {
    return { icon: 'Baby', group: 'group.family', budgetType: 'fixed', essential: true };
  }

  // 9. Savings / Sinking fund
  if (/saving|emergency|sinking|invest|target/.test(n)) {
    return { icon: 'PiggyBank', group: 'group.home', budgetType: 'savings', essential: false };
  }

  // 10. Fallback default
  return { icon: 'ShoppingBasket', group: 'group.home', budgetType: 'flexible', essential: false };
}
