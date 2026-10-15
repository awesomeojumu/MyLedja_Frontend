import type { IconName } from "../../design";

export interface DummyBudget {
  category: string;
  value: number;
  max: number;
}

export interface DummyRow {
  title: string;
  category: string;
  account: string;
  amount: number;
  kind: "expense" | "income" | "transfer";
  time: string;
  status?: "failed" | "pending" | null;
}

export interface DummyHome {
  currency: "NGN";
  balance: number;
  freshness: string;
  spent: number;
  income: number;
  budgets: DummyBudget[];
  recent: DummyRow[];
  heroActions: { label: string; icon: IconName }[];
}

export interface CashFlowMonth {
  label: string;
  inflow: number;
  outflow: number;
}

export interface CashFlowSeries {
  labels: string[];
  inflow: number[];
  outflow: number[];
}

export type CashFlowPeriod = "this-month" | "3-months" | "year";

export interface NamedAmount {
  name: string;
  amount: number;
}

export interface NetWorthPoint {
  label: string;
  value: number;
}

export interface UpcomingItem {
  id: string;
  title: string;
  when: string;
  amount: number;
}

export interface DashboardGoal {
  id: string;
  name: string;
  saved: number;
  target: number;
}

export interface DashboardInsight {
  id: string;
  title: string;
  body: string;
  amount?: number;
  tone: "primary" | "positive" | "warning";
}

export interface QuickAddTile {
  id: "expense" | "income" | "transfer" | "bill";
  label: string;
  icon: IconName;
}

export interface SearchHit {
  id: string;
  group: "Transactions" | "Accounts" | "Goals";
  title: string;
  subtitle: string;
  amount?: number;
}

export const HOME_DUMMY: DummyHome = {
  currency: "NGN",
  balance: 842150.75,
  freshness: "Updated 14:20",
  spent: 185500.25,
  income: 450000,
  budgets: [
    { category: "Food & groceries", value: 45000, max: 60000 },
    { category: "Transport", value: 18000, max: 20000 },
    { category: "Rent", value: 250000, max: 250000 },
  ],
  recent: [
    {
      title: "Market run",
      category: "Food & groceries",
      account: "Cash",
      amount: 3500,
      kind: "expense",
      time: "14:05",
      status: "failed",
    },
    {
      title: "Shoprite",
      category: "Food & groceries",
      account: "GTBank",
      amount: 12500.5,
      kind: "expense",
      time: "14:20",
    },
    {
      title: "Salary",
      category: "Salary",
      account: "GTBank",
      amount: 450000,
      kind: "income",
      time: "Yesterday",
    },
    {
      title: "Uber",
      category: "Transport",
      account: "GTBank",
      amount: 3200,
      kind: "expense",
      time: "Yesterday",
    },
    {
      title: "DSTV",
      category: "Subscriptions (DSTV, Netflix)",
      account: "GTBank",
      amount: 24500,
      kind: "expense",
      time: "Mon",
    },
  ],
  heroActions: [
    { label: "Add", icon: "plus" },
    { label: "Transfer", icon: "arrow-left-right" },
  ],
};

export const CASH_FLOW: { currency: "NGN"; months: CashFlowMonth[] } = {
  currency: "NGN",
  months: [
    { label: "Nov", inflow: 410000, outflow: 298000 },
    { label: "Dec", inflow: 455000, outflow: 372000 },
    { label: "Jan", inflow: 430000, outflow: 305000 },
    { label: "Feb", inflow: 430000, outflow: 288000 },
    { label: "Mar", inflow: 448000, outflow: 331000 },
    { label: "Apr", inflow: 440000, outflow: 319000 },
    { label: "May", inflow: 452000, outflow: 341000 },
    { label: "Jun", inflow: 460000, outflow: 355000 },
    { label: "Jul", inflow: 445000, outflow: 328000 },
    { label: "Aug", inflow: 462000, outflow: 349000 },
    { label: "Sep", inflow: 458000, outflow: 336000 },
    { label: "Oct", inflow: 450000, outflow: 185500.25 },
  ],
};

function seriesFrom(rows: CashFlowMonth[]): CashFlowSeries {
  return {
    labels: rows.map((row) => row.label),
    inflow: rows.map((row) => row.inflow),
    outflow: rows.map((row) => row.outflow),
  };
}

export function cashFlowForPeriod(period: CashFlowPeriod): CashFlowSeries {
  if (period === "this-month") {
    const last = CASH_FLOW.months[CASH_FLOW.months.length - 1];
    return {
      labels: ["W1", "W2", "W3", "W4"],
      inflow: [last.inflow * 0.2, last.inflow * 0.25, last.inflow * 0.3, last.inflow * 0.25],
      outflow: [last.outflow * 0.22, last.outflow * 0.18, last.outflow * 0.35, last.outflow * 0.25],
    };
  }
  if (period === "3-months") {
    return seriesFrom(CASH_FLOW.months.slice(-3));
  }
  return seriesFrom(CASH_FLOW.months);
}

const ASSETS: NamedAmount[] = [
  { name: "Cash", amount: 842150.75 },
  { name: "Savings", amount: 420000 },
];

const LIABILITIES: NamedAmount[] = [{ name: "Personal loan", amount: 180000 }];

export const NET_WORTH: {
  currency: "NGN";
  total: number;
  assets: NamedAmount[];
  liabilities: NamedAmount[];
  history: NetWorthPoint[];
} = {
  currency: "NGN",
  total: ASSETS.reduce((sum, row) => sum + row.amount, 0) - LIABILITIES.reduce((sum, row) => sum + row.amount, 0),
  assets: ASSETS,
  liabilities: LIABILITIES,
  history: [
    { label: "May", value: 890400 },
    { label: "Jun", value: 925100 },
    { label: "Jul", value: 974550 },
    { label: "Aug", value: 1012800 },
    { label: "Sep", value: 1045600 },
    { label: "Oct", value: 1082150.75 },
  ],
};

export const UPCOMING: UpcomingItem[] = [
  { id: "dstv", title: "DSTV", when: "18 Oct", amount: 24500 },
  { id: "data", title: "Data", when: "20 Oct", amount: 15000 },
  { id: "rent", title: "Rent", when: "1 Nov", amount: 250000 },
];

export const DASHBOARD_GOALS: DashboardGoal[] = [
  { id: "emergency", name: "Emergency", saved: 180000, target: 500000 },
  { id: "phone", name: "New phone", saved: 85000, target: 120000 },
  { id: "trip", name: "Trip home", saved: 40000, target: 200000 },
  { id: "laptop", name: "Laptop", saved: 0, target: 450000 },
];

export const DASHBOARD_INSIGHTS: DashboardInsight[] = [
  {
    id: "food",
    title: "Groceries are trending down",
    body: "Food & groceries is ₦8,400 under last month. Keep the Market run habit.",
    amount: 8400,
    tone: "positive",
  },
  {
    id: "rent",
    title: "Rent is due in 3 days",
    body: "₦250,000 will leave GTBank on 1 Nov. Move it to Cash if you pay in person.",
    amount: 250000,
    tone: "warning",
  },
  {
    id: "save",
    title: "You can top up Emergency",
    body: "In beat out by ₦264,499 this month. Sweep ₦20,000 into Emergency.",
    amount: 20000,
    tone: "primary",
  },
];

export const QUICK_ADD_TILES: QuickAddTile[] = [
  { id: "expense", label: "Add expense", icon: "arrow-down-left" },
  { id: "income", label: "Add income", icon: "arrow-up-right" },
  { id: "transfer", label: "Transfer", icon: "arrow-left-right" },
  { id: "bill", label: "Add bill", icon: "receipt" },
];

function transactionHits(): SearchHit[] {
  return HOME_DUMMY.recent.map((row) => ({
    id: `tx-${row.title}`,
    group: "Transactions",
    title: row.title,
    subtitle: `${row.category} · ${row.account}`,
    amount: row.amount,
  }));
}

function accountHits(): SearchHit[] {
  const names = [...new Set(HOME_DUMMY.recent.map((row) => row.account))];
  return names.map((name) => ({
    id: `ac-${name}`,
    group: "Accounts",
    title: name,
    subtitle: "Account",
  }));
}

function goalHits(): SearchHit[] {
  return DASHBOARD_GOALS.map((goal) => ({
    id: `goal-${goal.id}`,
    group: "Goals",
    title: goal.name,
    subtitle: "Goal",
    amount: goal.saved,
  }));
}

export function searchDashboard(query: string): SearchHit[] {
  const recent = transactionHits();
  const needle = query.trim().toLowerCase();
  if (!needle) return recent;
  const corpus = [...recent, ...accountHits(), ...goalHits()];
  return corpus.filter(
    (hit) => hit.title.toLowerCase().includes(needle) || hit.subtitle.toLowerCase().includes(needle),
  );
}
