import type { IconName } from "../../../design";

export type AccountKind = "bank" | "wallet" | "cash";

export type ImportBucket = "new" | "duplicates" | "look";

export interface LedgerAccount {
  id: string;
  name: string;
  kind: AccountKind;
  institution: string;
  currency: "NGN";
  balance: number;
  lastFour?: string;
  reconciled: boolean;
  lastActivity: string;
  icon: IconName;
}

export interface ImportRow {
  id: string;
  title: string;
  category: string;
  amount: number;
  kind: "expense" | "income" | "transfer";
  when: string;
  bucket: ImportBucket;
  note: string;
}

export interface AccountDraft {
  name: string;
  kind: AccountKind;
  opening: string;
}

export interface TransferDraft {
  fromId: string;
  toId: string;
  amount: string;
}
