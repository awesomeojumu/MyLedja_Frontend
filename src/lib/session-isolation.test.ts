import { createApiClient, type FetchLike } from "@/api/client";
import { memoryTokenStore, SessionCore } from "@/lib/session-core";
import { persistExpense } from "@/sync/outbox";
import { outboxForUser } from "@/sync/user-outbox";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function backend() {
  const refreshTokens = new Map<string, string>();
  const accessTokens = new Map<string, string>();
  let n = 0;
  const json = (status: number, body: unknown) => ({ status, text: async () => JSON.stringify(body) });
  const issue = (userId: string) => {
    n += 1;
    const accessToken = `at-${n}`;
    const refreshToken = `rt-${n}`;
    accessTokens.set(accessToken, userId);
    refreshTokens.set(refreshToken, userId);
    return { accessToken, refreshToken, userId, expiresIn: 900 };
  };
  const fetchImpl: FetchLike = async (url, init) => {
    const path = url.replace(/^.*\/v1/, "");
    const body = init.body ? (JSON.parse(init.body) as Record<string, string>) : {};
    if (init.method === "POST" && path === "/auth/login") {
      return json(200, issue(body.email === "b@x.com" ? "user-b" : "user-a"));
    }
    if (init.method === "POST" && path === "/auth/logout") return json(200, { status: "ok" });
    if (init.method === "GET" && path === "/auth/me") {
      const token = (init.headers.authorization ?? "").replace("Bearer ", "");
      const userId = accessTokens.get(token) ?? "user-a";
      return json(200, { userId, email: userId === "user-b" ? "b@x.com" : "a@x.com" });
    }
    if (init.method === "GET" && path === "/workspaces") return json(200, []);
    return json(404, { status: "error", error: "missing" });
  };
  return createApiClient("http://api.test", fetchImpl);
}

async function run(): Promise<void> {
  const session = new SessionCore(backend(), memoryTokenStore());
  await session.signIn("a@x.com", "password-a1");
  persistExpense(outboxForUser("user-a"), {
    operationId: "op-a",
    userId: "user-a",
    workspaceId: "ws-a",
    entityType: "transaction",
    entityId: "tx-a",
    operationType: "create",
    payload: { amount: "10.00" },
    syncStatus: "saved_on_device",
    attemptCount: 0,
  });
  assert(outboxForUser("user-a").list("user-a").length === 1, "user A has an outbox row");
  await session.signOut();
  assert(session.getState().user === null, "signed out clears the user");
  await session.signIn("b@x.com", "password-b1");
  assert(session.getState().user?.userId === "user-b", "session is user B");
  assert(outboxForUser("user-b").list("user-b").length === 0, "user B does not see user A outbox");
  assert(outboxForUser("user-a").list("user-a").length === 1, "user A row stays in A partition");
  console.log("session-isolation: logout then user B sees no user A data");
}

void run();
