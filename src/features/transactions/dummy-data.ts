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

export const QUEUE_ROWS: TxRow[] = [
  { id: "market", title: "Market run", category: "Food & groceries", account: "Cash", amount: 3500, kind: "expense", time: "14:05", status: "failed" },
  { id: "pending-airtime", title: "Airtime", category: "Data & airtime", account: "Opay", amount: 2000, kind: "expense", time: "Now", status: "pending" },
];

export const DUPLICATE_PAIRS = [
  { id: "dstv", title: "DSTV", amount: 24500, note: "Same merchant, same day" },
  { id: "uber", title: "Uber", amount: 3200, note: "Possible double tap" },
];

export const CORRECTIONS = [
  { id: "c1", title: "Shoprite category", when: "16 Oct", result: "Food & groceries" },
  { id: "c2", title: "Salary account", when: "1 Oct", result: "GTBank" },
];

export const CALENDAR_DAYS = [
  { day: "13", total: 12500.5 },
  { day: "14", total: 6700 },
  { day: "15", total: 24500 },
];

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
  return rows.reduce((sum, row) => {
    if (row.kind === "income") return sum + row.amount;
    if (row.kind === "transfer") return sum;
    return sum - row.amount;
  }, 0);
}
