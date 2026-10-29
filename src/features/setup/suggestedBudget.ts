/** Weights for a first-month plan from monthly take-home (DESIGN Page 4 step 5). */
const KEY_WEIGHTS: Record<string, number> = {
  'cat.rent': 30,
  'cat.electricity': 5,
  'cat.water': 2,
  'cat.fuel': 8,
  'cat.rideHailing': 5,
  'cat.okada': 2,
  'cat.market': 12,
  'cat.eatingOut': 5,
  'cat.schoolFees': 10,
  'cat.familySupport': 5,
  'cat.tithe': 10,
  'cat.offering': 2,
};

const DEFAULT_WEIGHT = 3;

export type SuggestedLine = { categoryId: string; amountMinor: bigint };

/**
 * Split take-home across expense categories that count in the budget.
 * Returns empty when take-home is null/zero or there are no categories.
 */
export function suggestedFirstBudget(
  takeHomeMinor: bigint | null | undefined,
  categories: { id: string; key?: string; kind: string; countInBudget: boolean; hidden?: boolean }[],
): SuggestedLine[] {
  if (takeHomeMinor == null || takeHomeMinor <= 0n) return [];
  const cats = categories.filter((c) => c.kind === 'expense' && c.countInBudget && !c.hidden);
  if (cats.length === 0) return [];

  const weights = cats.map((c) => KEY_WEIGHTS[c.key ?? ''] ?? DEFAULT_WEIGHT);
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const lines: SuggestedLine[] = [];
  let allocated = 0n;
  for (let i = 0; i < cats.length; i++) {
    const cat = cats[i]!;
    const isLast = i === cats.length - 1;
    const amount = isLast
      ? takeHomeMinor - allocated
      : (takeHomeMinor * BigInt(weights[i]!)) / BigInt(totalWeight);
    if (amount > 0n) {
      lines.push({ categoryId: cat.id, amountMinor: amount });
      allocated += amount;
    }
  }
  return lines;
}
