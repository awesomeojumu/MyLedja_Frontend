export interface TxRow {
  id: string;
  title: string;
  category: string;
  account: string;
  amount: number;
  kind: "expense" | "income" | "transfer";
  time: string;
  status?: "failed" | "pending" | null;
}

export const TRANSACTIONS: TxRow[] = [
  { id: "market", title: "Market run", category: "Food & groceries", account: "Cash", amount: 3500, kind: "expense", time: "14:05", status: "failed" },
  { id: "shoprite", title: "Shoprite", category: "Food & groceries", account: "GTBank", amount: 12500.5, kind: "expense", time: "14:20" },
  { id: "salary", title: "Salary", category: "Salary", account: "GTBank", amount: 450000, kind: "income", time: "Yesterday" },
  { id: "uber", title: "Uber", category: "Transport", account: "GTBank", amount: 3200, kind: "expense", time: "Yesterday" },
  { id: "dstv", title: "DSTV", category: "Subscriptions (DSTV, Netflix)", account: "GTBank", amount: 24500, kind: "expense", time: "Mon" },
];

export const REVIEW_ROWS: TxRow[] = TRANSACTIONS.filter((row) => row.status === "failed" || row.status === "pending");

export const RECURRING = [
  { id: "dstv", title: "DSTV", amount: 24500, when: "18th of each month" },
  { id: "rent", title: "Rent", amount: 250000, when: "1st of each month" },
];

export const SPLIT = [
  { category: "Food & groceries", amount: 8000 },
  { category: "Household items", amount: 4500.5 },
];

export function transactionById(id: string): TxRow | undefined {
  return TRANSACTIONS.find((row) => row.id === id);
}

export function nairaSum(rows: readonly TxRow[]): number {
  return rows.reduce((sum, row) => sum + (row.kind === "income" ? row.amount : -row.amount), 0);
}
