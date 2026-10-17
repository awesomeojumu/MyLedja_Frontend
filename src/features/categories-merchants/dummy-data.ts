import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/design/format";

export interface CategoryRow {
  id: string;
  name: string;
  kind: "expense" | "income";
  count: number;
}

export interface MerchantRow {
  id: string;
  name: string;
  category: string;
  count: number;
}

export const CATEGORY_ROWS: CategoryRow[] = [
  { id: "food", name: "Food & groceries", kind: "expense", count: 12 },
  { id: "transport", name: "Transport", kind: "expense", count: 8 },
  { id: "data", name: "Data & airtime", kind: "expense", count: 4 },
  { id: "salary", name: "Salary", kind: "income", count: 1 },
  { id: "dstv", name: "Subscriptions (DSTV, Netflix)", kind: "expense", count: 1 },
  { id: "rent", name: "Rent", kind: "expense", count: 1 },
];

export const MERCHANTS: MerchantRow[] = [
  { id: "shoprite", name: "Shoprite", category: "Food & groceries", count: 4 },
  { id: "uber", name: "Uber", category: "Transport", count: 9 },
  { id: "dstv", name: "DSTV", category: "Subscriptions (DSTV, Netflix)", count: 3 },
  { id: "mtn", name: "MTN", category: "Data & airtime", count: 6 },
];

export function categoryById(id: string): CategoryRow | undefined {
  return CATEGORY_ROWS.find((row) => row.id === id);
}

export function merchantById(id: string): MerchantRow | undefined {
  return MERCHANTS.find((row) => row.id === id);
}

export const ALL_CATEGORY_NAMES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];
