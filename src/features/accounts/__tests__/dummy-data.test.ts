import { formatMoney } from "../../../design/format";
import { HOME_DUMMY } from "../../dashboard/dummy-data";
import {
  ACCOUNTS,
  IMPORT_REVIEW,
  accountById,
  availableCash,
  importRowsFor,
} from "../dummy-data";
import { accountDraftIssues, transferDraftIssues } from "../services/account-draft";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(ACCOUNTS.length >= 3, "At least three accounts");
assert(
  ACCOUNTS.every((account) => account.currency === "NGN" && account.balance >= 0),
  "Every account is naira with a non-negative balance",
);
assert(ACCOUNTS.some((account) => account.kind === "bank"), "A bank account is present");
assert(ACCOUNTS.some((account) => account.kind === "cash"), "Cash is present");
assert(ACCOUNTS.some((account) => account.kind === "wallet"), "A wallet is present");

const total = availableCash(ACCOUNTS);
assert(Math.abs(total - HOME_DUMMY.balance) < 0.01, "Available cash matches Home dummy");
assert(formatMoney(total, "NGN").startsWith("₦"), "Total uses the naira sign");

const gtbank = accountById("gtbank");
assert(gtbank?.name === "GTBank Current", "GTBank Current is the import target");
assert(IMPORT_REVIEW.accountId === "gtbank", "Import review is for GTBank");
assert(IMPORT_REVIEW.counts.new === 128, "128 new records");
assert(IMPORT_REVIEW.counts.duplicates === 12, "12 duplicates");
assert(IMPORT_REVIEW.counts.look === 3, "3 need a look");
assert(IMPORT_REVIEW.closingBalance === 612400.5, "Statement closing balance is ₦612,400.50");
assert(importRowsFor("new").length >= 4, "New tab has sample rows");
assert(importRowsFor("look").length === 3, "Need-a-look tab has three rows");
assert(
  importRowsFor("new").every((row) => row.bucket === "new"),
  "New filter returns only new rows",
);

assert(accountDraftIssues({ name: "", kind: "bank", opening: "0" }).length > 0, "Blank name is rejected");
assert(accountDraftIssues({ name: "Cash tin", kind: "cash", opening: "5000" }).length === 0, "Named cash account is valid");
assert(
  transferDraftIssues({ fromId: "gtbank", toId: "gtbank", amount: "1000" }).length > 0,
  "Transfer to the same account is rejected",
);
assert(
  transferDraftIssues({ fromId: "gtbank", toId: "cash", amount: "1000" }).length === 0,
  "Transfer between two accounts is valid",
);

console.log("accounts dummy data: naira list, GTBank import review, drafts");
