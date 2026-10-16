import type { ImportBucket, ImportRow, LedgerAccount } from "./types/account";

export const ACCOUNTS: LedgerAccount[] = [
  {
    id: "gtbank",
    name: "GTBank Current",
    kind: "bank",
    institution: "Guaranty Trust Bank",
    currency: "NGN",
    balance: 522550,
    lastFour: "4402",
    reconciled: false,
    lastActivity: "14 Oct",
    icon: "landmark",
  },
  {
    id: "cash",
    name: "Cash",
    kind: "cash",
    institution: "On hand",
    currency: "NGN",
    balance: 185000,
    reconciled: true,
    lastActivity: "16 Oct",
    icon: "banknote",
  },
  {
    id: "opay",
    name: "Opay",
    kind: "wallet",
    institution: "Opay",
    currency: "NGN",
    balance: 134600.75,
    lastFour: "8811",
    reconciled: true,
    lastActivity: "15 Oct",
    icon: "smartphone",
  },
];

const NEW_ROWS: ImportRow[] = [
  {
    id: "shoprite",
    title: "POS Shoprite Lekki",
    category: "Food & groceries",
    amount: 24350,
    kind: "expense",
    when: "19 Sep",
    bucket: "new",
    note: "will be added",
  },
  {
    id: "studio-ade",
    title: "NIP transfer from Studio Ade",
    category: "Business income",
    amount: 120000,
    kind: "income",
    when: "17 Sep",
    bucket: "new",
    note: "will be added",
  },
  {
    id: "airtime",
    title: "Airtime MTN",
    category: "Data & airtime",
    amount: 2000,
    kind: "expense",
    when: "15 Sep",
    bucket: "new",
    note: "will be added",
  },
  {
    id: "bolt",
    title: "Bolt ride",
    category: "Transport",
    amount: 3800,
    kind: "expense",
    when: "14 Sep",
    bucket: "new",
    note: "will be added",
  },
];

const DUPLICATE_ROWS: ImportRow[] = [
  {
    id: "dstv-dup",
    title: "DSTV",
    category: "Subscriptions (DSTV, Netflix)",
    amount: 24500,
    kind: "expense",
    when: "12 Sep",
    bucket: "duplicates",
    note: "already recorded",
  },
  {
    id: "uber-dup",
    title: "Uber",
    category: "Transport",
    amount: 3200,
    kind: "expense",
    when: "10 Sep",
    bucket: "duplicates",
    note: "already recorded",
  },
];

const LOOK_ROWS: ImportRow[] = [
  {
    id: "unknown-pos",
    title: "POS unknown",
    category: "Other",
    amount: 4200,
    kind: "expense",
    when: "18 Sep",
    bucket: "look",
    note: "choose a category",
  },
  {
    id: "okafor",
    title: "Transfer from J. Okafor",
    category: "Other",
    amount: 15000,
    kind: "income",
    when: "16 Sep",
    bucket: "look",
    note: "is this income?",
  },
  {
    id: "web-pay",
    title: "WEB PAY",
    category: "Other",
    amount: 1850,
    kind: "expense",
    when: "13 Sep",
    bucket: "look",
    note: "merchant is unclear",
  },
];

export const IMPORT_REVIEW = {
  accountId: "gtbank",
  accountName: "GTBank Current",
  fileName: "GTBank_Sep2026.csv",
  closingBalance: 612400.5,
  counts: { new: 128, duplicates: 12, look: 3 },
  rows: [...NEW_ROWS, ...DUPLICATE_ROWS, ...LOOK_ROWS],
};

export const ACCOUNT_ACTIVITY: Record<string, ImportRow[]> = {
  gtbank: NEW_ROWS,
  cash: [
    {
      id: "market",
      title: "Market run",
      category: "Food & groceries",
      amount: 3500,
      kind: "expense",
      when: "16 Oct",
      bucket: "new",
      note: "Cash",
    },
  ],
  opay: [
    {
      id: "data",
      title: "Data",
      category: "Data & airtime",
      amount: 15000,
      kind: "expense",
      when: "15 Oct",
      bucket: "new",
      note: "Opay",
    },
  ],
};

export const COLUMN_OPTIONS = [
  { value: "date", label: "Date" },
  { value: "description", label: "Description" },
  { value: "amount", label: "Amount" },
  { value: "skip", label: "Skip this column" },
];

export const STATEMENT_COLUMNS = [
  { header: "Tran Date", mapped: "date", sample: "19/09/2026" },
  { header: "Narration", mapped: "description", sample: "POS Shoprite Lekki" },
  { header: "Debit", mapped: "amount", sample: "24350.00" },
  { header: "Credit", mapped: "amount", sample: "120000.00" },
  { header: "Balance", mapped: "skip", sample: "612400.50" },
];

export function availableCash(accounts: readonly LedgerAccount[] = ACCOUNTS): number {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function accountById(id: string): LedgerAccount | undefined {
  return ACCOUNTS.find((account) => account.id === id);
}

export function importRowsFor(bucket: ImportBucket, rows: readonly ImportRow[] = IMPORT_REVIEW.rows): ImportRow[] {
  return rows.filter((row) => row.bucket === bucket);
}

export function kindLabel(kind: LedgerAccount["kind"]): string {
  if (kind === "bank") return "Bank";
  if (kind === "wallet") return "Wallet";
  return "Cash";
}
