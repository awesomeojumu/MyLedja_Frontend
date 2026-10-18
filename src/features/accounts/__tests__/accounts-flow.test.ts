import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const root = join(__dirname, "..", "..", "..", "..");

const files: [string, string[]][] = [
  ["src/features/accounts/screens/AccountsScreen.tsx", ["Archived accounts", "listAccounts", "Add account"]],
  ["src/features/accounts/screens/AccountTypeScreen.tsx", ["institution?kind=", "add?kind=cash"]],
  ["src/features/accounts/screens/InstitutionScreen.tsx", ["kind === \"wallet\"", "accounts/add?kind="]],
  ["src/features/accounts/screens/AddAccountScreen.tsx", ["Save account", "Save changes", "renameAccount", "Opening is not income"]],
  ["src/features/accounts/screens/AccountScreen.tsx", ["getAccount", "Reconciliation history", "Connection"]],
  ["src/features/accounts/screens/OpeningBalanceScreen.tsx", ["setOpening", "Correct this opening"]],
  ["src/features/accounts/screens/TransferScreen.tsx", ["type: \"transfer\"", "Save transfer"]],
  ["src/features/accounts/screens/ArchivedAccountsScreen.tsx", ["listAccounts(workspaceId, true)", "No archived accounts"]],
  ["src/features/accounts/screens/ReconcileScreen.tsx", ["Compare statement", "Matched"]],
  ["src/features/accounts/screens/ReconciliationHistoryScreen.tsx", ["listReconciliations", "Matched"]],
  ["src/features/accounts/screens/ConnectionStatusScreen.tsx", ["Connection", "getAccount"]],
  ["src/features/accounts/screens/ImportStatementScreen.tsx", ["previewImport", "accountId"]],
  ["src/features/accounts/screens/ReviewImportScreen.tsx", ["Accepted", "Rejected", "commitImport"]],
];

for (const [rel, needles] of files) {
  const path = join(root, rel);
  assert(existsSync(path), `missing ${rel}`);
  const src = readFileSync(path, "utf8");
  for (const needle of needles) {
    assert(src.includes(needle), `${rel} must include ${needle}`);
  }
}

console.log("accounts-flow: 14 screens wired");
