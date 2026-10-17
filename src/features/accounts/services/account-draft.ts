import type { AccountDraft, TransferDraft } from "@/features/accounts/types/account";

export interface DraftIssue {
  field: string;
  message: string;
}

export function accountDraftIssues(draft: AccountDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!draft.name.trim()) issues.push({ field: "name", message: "Give this account a name." });
  if (!draft.kind) issues.push({ field: "kind", message: "Choose bank, wallet or cash." });
  if (draft.opening.trim() && Number.isNaN(Number(draft.opening))) {
    issues.push({ field: "opening", message: "Opening balance must be a naira amount." });
  }
  return issues;
}

export function transferDraftIssues(draft: TransferDraft): DraftIssue[] {
  const issues: DraftIssue[] = [];
  if (!draft.fromId) issues.push({ field: "fromId", message: "Choose where the money leaves." });
  if (!draft.toId) issues.push({ field: "toId", message: "Choose where the money arrives." });
  if (draft.fromId && draft.toId && draft.fromId === draft.toId) {
    issues.push({ field: "toId", message: "Pick two different accounts." });
  }
  const amount = Number(draft.amount);
  if (!draft.amount.trim() || !(amount > 0)) {
    issues.push({ field: "amount", message: "Enter an amount greater than zero." });
  }
  return issues;
}

export function savedAccountMessage(name: string): string {
  return `${name} is on this workspace.`;
}

export function savedTransferMessage(amountLabel: string): string {
  return `Moved ${amountLabel} between your accounts.`;
}
