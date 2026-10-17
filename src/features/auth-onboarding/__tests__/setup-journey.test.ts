import { createApiClient, type FetchLike } from "@/api/client";
import { afterChecklist } from "@/features/auth-onboarding/services/auth-flow";
import { EMPTY_SETUP, markSetup, nextSetupStep, type SetupProgress } from "@/features/auth-onboarding/services/setup-progress";
import { memoryTokenStore, SessionCore } from "@/lib/session-core";
import { sqliteOutbox } from "@/sync/outbox-sqlite-fs";
import { drainOnce, persistExpense } from "@/sync/outbox";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function journeyBackend() {
  const accessTokens = new Map<string, string>();
  const refreshTokens = new Map<string, string>();
  const accounts: { id: string; name: string }[] = [];
  const transactions: { operationId: string }[] = [];
  let setupProgress: SetupProgress = { ...EMPTY_SETUP };
  let defaultCurrency = "NGN";
  let counter = 0;
  const json = (status: number, body: unknown) => ({ status, text: async () => JSON.stringify(body) });
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace(/^.*\/v1/, "");
    const body = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    const key = `${init.method} ${path.replace(/\/[0-9a-f-]{36}/g, "/:id")}`;
    if (init.method === "POST" && path === "/auth/login") {
      counter += 1;
      const accessToken = `at-${counter}`;
      const refreshToken = `rt-${counter}`;
      accessTokens.set(accessToken, "user-a");
      refreshTokens.set(refreshToken, "user-a");
      return json(200, { accessToken, refreshToken, userId: "user-a", expiresIn: 900 });
    }
    if (init.method === "GET" && path === "/auth/me") {
      return json(200, { userId: "user-a", email: "a@example.com" });
    }
    if (init.method === "GET" && path === "/workspaces") {
      return json(200, [{ id: "11111111-1111-7111-8111-111111111111", name: "Personal", kind: "personal", role: "owner" }]);
    }
    if (init.method === "GET" && path.endsWith("/workspaces/11111111-1111-7111-8111-111111111111")) {
      return json(200, { id: "11111111-1111-7111-8111-111111111111", defaultCurrency, setupProgress });
    }
    if (init.method === "PATCH" && path.endsWith("/setup")) {
      if (typeof body.defaultCurrency === "string") defaultCurrency = body.defaultCurrency;
      setupProgress = { ...setupProgress, ...(body.setupProgress as SetupProgress) };
      return json(200, { status: "ok", data: { setupProgress, defaultCurrency } });
    }
    if (init.method === "POST" && path.endsWith("/accounts") && !path.includes("/opening")) {
      const id = `acc-${accounts.length + 1}`;
      accounts.push({ id, name: String(body.name) });
      setupProgress = markSetup(setupProgress, "firstAccount");
      return json(201, { status: "ok", data: { id } });
    }
    if (init.method === "GET" && path.endsWith("/accounts")) {
      return json(200, { status: "ok", data: accounts });
    }
    if (init.method === "POST" && path.includes("/opening")) {
      setupProgress = markSetup(setupProgress, "opening");
      return json(200, { status: "ok", data: { opening: body.opening } });
    }
    if (init.method === "GET" && path.endsWith("/categories")) {
      setupProgress = markSetup(setupProgress, "categories");
      return json(200, { status: "ok", data: [{ id: "cat-1", name: "Food & groceries", kind: "expense" }] });
    }
    if (init.method === "POST" && path.endsWith("/transactions")) {
      const operationId = String(body.operationId);
      if (!transactions.some((row) => row.operationId === operationId)) transactions.push({ operationId });
      setupProgress = markSetup(setupProgress, "firstTransaction");
      return json(201, { status: "ok", data: { transaction: { id: operationId } } });
    }
    void key;
    return json(404, { error: `unhandled ${init.method} ${path}` });
  };
  return {
    fetchImpl,
    snapshot: () => ({ accounts: accounts.length, transactions: transactions.length, setupProgress, defaultCurrency }),
  };
}

async function run(): Promise<void> {
  assert(afterChecklist() === "/(tabs)", "checklist skip lands on home");
  assert(nextSetupStep(EMPTY_SETUP)?.key === "currency", "skip-all leaves the first step open");

  const skip = journeyBackend();
  assert(skip.snapshot().accounts === 0 && skip.snapshot().transactions === 0, "skip-all creates nothing");

  const live = journeyBackend();
  const session = new SessionCore(createApiClient("http://api.test", live.fetchImpl), memoryTokenStore());
  await session.signIn("a@example.com", "password-ok");
  const ws = "11111111-1111-7111-8111-111111111111";
  await session.patchSetup(ws, { defaultCurrency: "NGN", setupProgress: { currency: true } });
  const created = await session.createAccount(ws, { name: "Cash", kind: "cash", opening: "0.00", connectionType: "manual" });
  await session.setOpening(ws, created.data.id, "5000.00");
  await session.listCategories(ws);
  const dir = mkdtempSync(join(tmpdir(), "journey-"));
  mkdirSync(dir, { recursive: true });
  const store = await sqliteOutbox("user-a", dir);
  persistExpense(store, {
    operationId: "01999999-9999-7999-8999-999999999999",
    userId: "user-a",
    workspaceId: ws,
    entityType: "transaction",
    entityId: "tx-1",
    operationType: "create",
    payload: { type: "expense", amount: "1500.00", accountId: created.data.id, description: "Market" },
    syncStatus: "saved_on_device",
    attemptCount: 0,
  });
  const sent = await drainOnce(store, "user-a", async (payload, operationId) => {
    await session.createTransaction(ws, { ...(payload as object), operationId });
    return true;
  });
  const after = live.snapshot();
  assert(sent === 1, "one expense left the outbox");
  assert(after.accounts === 1 && after.transactions === 1, "do-all writes one account and one expense");
  assert(after.setupProgress.firstTransaction, "checklist marks first transaction");
  assert(nextSetupStep(after.setupProgress) === null, "do-all completes the wizard");
  rmSync(dir, { recursive: true, force: true });
  console.log("setup-journey: skip-all empty, do-all one expense");
}

void run();
