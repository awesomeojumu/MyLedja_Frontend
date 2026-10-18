import { ApiError } from "@/api/client";
import { rememberAccountOptions } from "@/features/accounts/services/account-options";
import { commitAdd } from "@/features/transactions/services/commit-add";
import { quickExpenseDraft } from "@/features/transactions/services/add-draft";
import { memoryKeyValue, setKeyValueBackend } from "@/lib/offline-cache";
import { memoryOutbox } from "@/sync/outbox";
import { savedToast } from "@/sync/save-transaction";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  setKeyValueBackend(memoryKeyValue());
  const userId = "user-a";
  const workspaceId = "ws-1";
  rememberAccountOptions(userId, workspaceId, [{ id: "acc-gtb", name: "GTBank Salary" }]);

  const draft = { ...quickExpenseDraft(), amount: "1500" };
  const store = memoryOutbox();

  const result = await commitAdd(
    store,
    {
      userId,
      workspaceId,
      draft,
      accounts: rememberAccountOptions(userId, workspaceId, [{ id: "acc-gtb", name: "GTBank Salary" }]),
      knownEmpty: false,
    },
    async () => {
      throw new ApiError(0, "network", "offline");
    },
  );

  assert(result.kind === "saved", "offline save still writes");
  if (result.kind === "saved") {
    assert(result.outcome === "saved_on_device", "stays on the device");
    assert(result.toast === savedToast("expense", "saved_on_device"), "offline toast");
  }
  const rows = store.list(userId);
  assert(rows.length === 1, "one outbox row");
  assert((rows[0].payload as { accountId: string }).accountId === "acc-gtb", "uses the cached account");

  const emptyStore = memoryOutbox();
  const refused = await commitAdd(
    emptyStore,
    {
      userId,
      workspaceId,
      draft,
      accounts: [],
      knownEmpty: true,
    },
    async () => {
      throw new Error("must not post");
    },
  );
  assert(refused.kind === "refused", "empty list refuses");
  if (refused.kind === "refused") assert(refused.message === "Add an account first.", "empty copy");
  assert(emptyStore.list(userId).length === 0, "writes nothing when there is no account");

  console.log("offline-save: cached account queues; empty list refuses");
}

void run();
