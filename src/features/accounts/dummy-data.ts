import type { ImportBucket, ImportRow, LedgerAccount } from "@/features/accounts/types/account";

export const ACCOUNTS: LedgerAccount[] = [
  {
    id: "gtbank",
    name: "GTBank Current",
    kind: "bank",
    institution: "Guaranty Trust Bank",
    currency: "NGN",
    balance: 522550,
    lastFour: "4402",
    reconciled: true,
    lastActivity: "14 Oct",
    icon: "landmark",
    group: "cash-and-bank",
    statusLine: "Bank account · reconciled 30 Sep",
  },
  {
    id: "access",
    name: "Access Savings",
    kind: "bank",
    institution: "Access Bank",
    currency: "NGN",
    balance: 0,
    lastFour: "2291",
    reconciled: false,
    lastActivity: "14 Oct",
    icon: "landmark",
    group: "cash-and-bank",
    statusLine: "Bank account · updated 14:20",
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
    group: "cash-and-bank",
    statusLine: "Cash · counted 16 Oct",
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
    group: "cash-and-bank",
    statusLine: "Mobile wallet · updated 14:20",
    unsynced: 1,
  },
  {
    id: "piggy",
    name: "PiggyVest",
    kind: "savings",
    institution: "PiggyVest",
    currency: "NGN",
    balance: 450000,
    reconciled: true,
    lastActivity: "1 Oct",
    icon: "piggy-bank",
    group: "savings",
    statusLine: "Savings · locked till 1 Dec",
  },
  {
    id: "kuda-save",
    name: "Kuda Save",
    kind: "savings",
    institution: "Kuda",
    currency: "NGN",
    balance: 0,
    reconciled: true,
    lastActivity: "12 Oct",
    icon: "piggy-bank",
    group: "savings",
    statusLine: "Savings · updated 12 Oct",
  },
  {
    id: "loan",
    name: "Carbon loan",
    kind: "liability",
    institution: "Carbon",
    currency: "NGN",
    balance: 900000,
    reconciled: false,
    lastActivity: "1 Oct",
    icon: "credit-card",
    group: "liability",
    statusLine: "Loan · next due 1 Nov",
  },
];

export const ARCHIVED_ACCOUNTS: LedgerAccount[] = [
  {
    id: "old-uba",
    name: "UBA Current",
    kind: "bank",
    institution: "UBA",
    currency: "NGN",
    balance: 0,
    lastFour: "1188",
    reconciled: true,
    lastActivity: "12 Aug",
    icon: "landmark",
    group: "cash-and-bank",
    statusLine: "Archived 12 Aug",
    archived: true,
  },
];

export const INSTITUTIONS = [
  { id: "gtbank", name: "Guaranty Trust Bank" },
  { id: "access", name: "Access Bank" },
  { id: "kuda", name: "Kuda" },
  { id: "opay", name: "Opay" },
  { id: "uba", name: "UBA" },
];

export const ACCOUNT_TYPES = [
  { id: "bank", title: "Bank account", body: "Current or savings at a Nigerian bank." },
  { id: "wallet", title: "Mobile wallet", body: "Opay, Palmpay, Kuda or similar." },
  { id: "cash", title: "Cash", body: "Notes and coins you count yourself." },
  { id: "savings", title: "Savings pot", body: "Locked or goal savings." },
];

export const RECONCILE_HISTORY = [
  { id: "sep", when: "30 Sep 2026", account: "GTBank Current", result: "Matched" },
  { id: "aug", when: "31 Aug 2026", account: "GTBank Current", result: "Matched after import" },
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
  return accounts
    .filter((account) => account.id === "gtbank" || account.id === "cash" || account.id === "opay")
    .reduce((sum, account) => sum + account.balance, 0);
}

export function youOwn(accounts: readonly LedgerAccount[] = ACCOUNTS): number {
  return accounts.filter((account) => account.group !== "liability").reduce((sum, account) => sum + account.balance, 0);
}

export function youOwe(accounts: readonly LedgerAccount[] = ACCOUNTS): number {
  return accounts.filter((account) => account.group === "liability").reduce((sum, account) => sum + account.balance, 0);
}

export function groupTotal(group: LedgerAccount["group"], accounts: readonly LedgerAccount[] = ACCOUNTS): number {
  return accounts.filter((account) => account.group === group).reduce((sum, account) => sum + account.balance, 0);
}

export function activeAccounts(accounts: readonly LedgerAccount[] = ACCOUNTS): LedgerAccount[] {
  return accounts.filter((account) => !account.archived);
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
  if (kind === "savings") return "Savings";
  if (kind === "liability") return "You owe";
  return "Cash";
}
