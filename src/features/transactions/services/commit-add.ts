import { descriptionFor, draftIssues, type AddDraft } from "@/features/transactions/services/add-draft";
import { accountForSave, accountGateMessage, type AccountOption } from "@/features/accounts/services/account-options";
import { saveTransaction, savedToast, type PostTransaction, type SaveOutcome } from "@/sync/save-transaction";
import type { OutboxStore } from "@/sync/outbox";

export type CommitAddResult =
  | { kind: "saved"; outcome: SaveOutcome; toast: string }
  | { kind: "refused"; message: string }
  | { kind: "invalid"; issues: ReturnType<typeof draftIssues> };

export async function commitAdd(
  store: OutboxStore,
  input: {
    userId: string;
    workspaceId: string;
    draft: AddDraft;
    chosenAccountId?: string;
    accounts: AccountOption[] | null;
    knownEmpty: boolean;
    categoryId?: string;
    toAccountId?: string;
  },
  post: PostTransaction,
): Promise<CommitAddResult> {
  const issues = draftIssues(input.draft);
  if (issues.length > 0) return { kind: "invalid", issues };
  const gate = accountForSave(input.chosenAccountId, input.accounts, input.knownEmpty);
  if (!gate.ok) return { kind: "refused", message: accountGateMessage(gate.reason) };
  const description = descriptionFor(input.draft);
  const amount = input.draft.amount.includes(".") ? input.draft.amount : `${input.draft.amount}.00`;
  const payload =
    input.draft.kind === "transfer"
      ? { type: "transfer", amount, accountId: gate.accountId, toAccountId: input.toAccountId, description, status: "posted" }
      : { type: input.draft.kind, amount, accountId: gate.accountId, categoryId: input.categoryId, description, status: "posted" };
  const outcome = await saveTransaction(store, { userId: input.userId, workspaceId: input.workspaceId, payload }, post);
  return { kind: "saved", outcome, toast: savedToast(input.draft.kind, outcome) };
}
