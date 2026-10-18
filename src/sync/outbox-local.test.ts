import { localOutbox, outboxStorageKey } from "@/sync/outbox-local";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

const disk = new Map<string, string>();
const storage = { getItem: (k: string) => disk.get(k) ?? null, setItem: (k: string, v: string) => void disk.set(k, v) };
const record = {
  operationId: "op-1",
  userId: "user-a",
  workspaceId: "ws-1",
  entityType: "transaction" as const,
  entityId: "op-1",
  operationType: "create" as const,
  payload: { amount: "450.00" },
  syncStatus: "saved_on_device" as const,
  attemptCount: 0,
};

async function run(): Promise<void> {
  localOutbox("user-a", storage).save(record);
  const reloaded = localOutbox("user-a", storage);
  assertEqual(reloaded.list("user-a").length, 1, "the queued record survives a reload");
  reloaded.mark("op-1", "failed_temporarily");
  assertEqual(localOutbox("user-a", storage).list("user-a")[0].syncStatus, "failed_temporarily", "status changes persist");
  assertEqual(localOutbox("user-b", storage).list("user-b").length, 0, "another user's outbox is separate");
  assertEqual(reloaded.list("user-b").length, 0, "a store never lists another user's rows");
  assertEqual(disk.has(outboxStorageKey("user-a")), true, "stored under a per-user key");

  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const wiring = readFileSync(join(__dirname, "user-outbox.ts"), "utf8");
  const web = readFileSync(join(__dirname, "outbox-sqlite-web.ts"), "utf8");
  if (!wiring.includes("Platform.OS") || !wiring.includes("localOutbox")) {
    throw new Error("web outbox must use Platform.OS and localOutbox");
  }
  if (web.includes("memoryOutbox") || !web.includes("localOutbox")) {
    throw new Error("outbox-sqlite-web must persist with localOutbox");
  }
  console.log("outbox-local: survives reload, per-user, status persists");
}

void run();
