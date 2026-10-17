import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertRowUser, sqlitePathForUser } from "@/database/sqlite-partition";
import { sqliteOutbox } from "@/sync/outbox-sqlite-fs";
import { drainOnce, pendingBadge, persistExpense } from "@/sync/outbox";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(sqlitePathForUser("user-a") === "myledja-user-a.db", "one file per user");
assert(sqlitePathForUser("user-b") !== sqlitePathForUser("user-a"), "users do not share a file");
try {
  assertRowUser("user-a", "user-b");
  throw new Error("cross-user insert should fail");
} catch (error) {
  assert(error instanceof Error && error.message.includes("does not belong"), "wrong user rejected");
}

const dir = mkdtempSync(join(tmpdir(), "myledja-outbox-"));
mkdirSync(dir, { recursive: true });

async function run(): Promise<void> {
  const first = await sqliteOutbox("user-a", dir);
  persistExpense(first, {
    operationId: "op-1",
    userId: "user-a",
    workspaceId: "ws",
    entityType: "transaction",
    entityId: "tx-1",
    operationType: "create",
    payload: { amount: "10.00" },
    syncStatus: "saved_on_device",
    attemptCount: 0,
  });
  assert(first.list("user-a").length === 1, "survives in sqlite after save");
  assert(first.list("user-b").length === 0, "user B cannot see user A");
  assert(pendingBadge("saved_on_device"), "badge until ack");

  const afterKill = await sqliteOutbox("user-a", dir);
  assert(afterKill.list("user-a").length === 1, "survives process kill via the same db file");

  let posts = 0;
  const sent = await drainOnce(afterKill, "user-a", async () => {
    posts += 1;
    return true;
  });
  assert(sent === 1 && posts === 1, "one POST");
  const again = await drainOnce(afterKill, "user-a", async () => {
    posts += 1;
    return true;
  });
  assert(again === 0 && posts === 1, "second drain sends nothing");
  assert(!pendingBadge(afterKill.list("user-a")[0]?.syncStatus ?? "saved_on_device"), "badge clears after ack");
  rmSync(dir, { recursive: true, force: true });
  console.log("outbox: TC-10 once, badge, SQLite partition, kill");
}

void run();
