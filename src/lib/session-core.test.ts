import { ApiError, createApiClient, type FetchLike } from "../api/client";
import { memoryTokenStore, SessionCore, UnverifiedEmailError } from "./session-core";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

interface FakeUser {
  id: string;
  email: string;
  password: string;
  verified: boolean;
  code: string;
}

/** A small stand-in for the /v1 API: enough to drive the session through real HTTP shapes. */
function fakeBackend() {
  const users = new Map<string, FakeUser>();
  const refreshTokens = new Map<string, string>();
  const accessTokens = new Map<string, string>();
  const calls: string[] = [];
  let counter = 0;
  let expireNextAccess = false;
  let offline = false;

  const json = (status: number, body: unknown) => ({ status, text: async () => JSON.stringify(body) });
  const issue = (userId: string) => {
    counter += 1;
    const accessToken = `at-${counter}`;
    const refreshToken = `rt-${counter}`;
    accessTokens.set(accessToken, userId);
    refreshTokens.set(refreshToken, userId);
    return { accessToken, refreshToken, userId, expiresIn: 900 };
  };
  const authUser = (headers: Record<string, string>) => {
    const token = (headers.authorization ?? "").replace("Bearer ", "");
    if (expireNextAccess) {
      expireNextAccess = false;
      accessTokens.delete(token);
    }
    return accessTokens.get(token);
  };

  const fetchImpl: FetchLike = async (url, init) => {
    if (offline) throw new TypeError("Network request failed");
    const path = url.replace(/^.*\/v1/, "");
    calls.push(`${init.method} ${path}`);
    const body = init.body ? (JSON.parse(init.body) as Record<string, string>) : {};
    switch (`${init.method} ${path}`) {
      case "POST /auth/register": {
        if (!users.has(body.email)) {
          users.set(body.email, { id: `u-${body.email}`, email: body.email, password: body.password, verified: false, code: "123456" });
        }
        return json(202, { status: "accepted" });
      }
      case "POST /auth/verify/resend":
        return json(202, { status: "accepted" });
      case "POST /auth/verify": {
        const user = users.get(body.email);
        if (!user || user.code !== body.code) return json(401, { status: "error", error: "invalid code" });
        user.verified = true;
        return json(200, { status: "verified", userId: user.id, workspaceId: `ws-${user.id}` });
      }
      case "POST /auth/login": {
        const user = users.get(body.email);
        if (!user || user.password !== body.password) return json(401, { status: "error", error: "invalid credentials" });
        if (!user.verified) return json(403, { status: "error", error: "email not verified" });
        return json(200, issue(user.id));
      }
      case "POST /auth/refresh": {
        const userId = refreshTokens.get(body.refreshToken);
        if (!userId) return json(401, { status: "error", error: "invalid refresh token" });
        refreshTokens.delete(body.refreshToken);
        return json(200, issue(userId));
      }
      case "POST /auth/logout":
        refreshTokens.delete(body.refreshToken);
        return json(200, { status: "ok" });
      case "POST /auth/recovery":
        return json(202, { status: "accepted" });
      case "POST /auth/recovery/confirm":
        return json(200, { status: "reset" });
      case "GET /auth/me": {
        const userId = authUser(init.headers);
        if (!userId) return json(401, { status: "error", error: "invalid access token" });
        const user = [...users.values()].find((u) => u.id === userId);
        return json(200, { userId, email: user?.email });
      }
      case "GET /workspaces": {
        const userId = authUser(init.headers);
        if (!userId) return json(401, { status: "error", error: "invalid access token" });
        return json(200, [{ id: `ws-${userId}`, name: "Personal", kind: "personal", role: "owner" }]);
      }
      case "POST /bank-integrations/link": {
        if (!authUser(init.headers)) return json(401, { status: "error", error: "invalid access token" });
        return json(200, { status: "ok", data: { monoUrl: "https://connect.mono.co/sandbox" } });
      }
      case "POST /bank-integrations/link/complete": {
        if (!authUser(init.headers)) return json(401, { status: "error", error: "invalid access token" });
        return json(200, {
          status: "ok",
          data: { provider: "mono", institution: "GTBank", name: "Ada", mask: "3465", balance: 20000, currency: "NGN" },
        });
      }
      default:
        return json(404, { status: "error", error: "not found" });
    }
  };

  return {
    fetchImpl,
    calls,
    refreshTokens,
    expireNextAccess: () => {
      expireNextAccess = true;
    },
    setOffline: (value: boolean) => {
      offline = value;
    },
  };
}

async function main(): Promise<void> {
  const backend = fakeBackend();
  const api = createApiClient("http://api.test/", backend.fetchImpl);
  const store = memoryTokenStore();
  const session = new SessionCore(api, store);

  assertEqual(session.getState().status, "loading", "starts loading");
  await session.restore();
  assertEqual(session.getState().status, "signedOut", "no stored token means signed out");

  // register → verify signs straight in
  await session.register(" Ada@Example.com ", "correct-horse-1");
  assertEqual(session.getState().pendingEmail, "ada@example.com", "pending email is normalized");
  let threw = false;
  try {
    await session.verify("000000");
  } catch (error) {
    threw = error instanceof ApiError && error.message.includes("wrong or has expired");
  }
  assert(threw, "a wrong code shows a friendly message");
  assertEqual(await session.verify("123456"), "signedIn", "verify signs in with the held password");
  let state = session.getState();
  assertEqual(state.status, "signedIn", "signed in after verify");
  assertEqual(state.user?.email, "ada@example.com", "user loaded from /me");
  assertEqual(state.workspaces[0]?.id, "ws-u-ada@example.com", "workspace loaded");
  assertEqual(state.pendingEmail, null, "pending email cleared");
  const stored = await store.get();
  assert(!!stored && stored.startsWith("rt-"), "refresh token persisted in the token store");

  // an expired access token refreshes once and retries
  backend.expireNextAccess();
  const me = await session.authed((token) => api.me(token));
  assertEqual(me.email, "ada@example.com", "authed call retried after refresh");
  assert((await store.get()) !== stored, "refresh rotated the stored token");

  const started = await session.startBankLink(state.workspaces[0]?.id);
  assertEqual(started.data.monoUrl, "https://connect.mono.co/sandbox", "startBankLink returns the widget URL");
  const linked = await session.completeBankLink("sandbox-code", state.workspaces[0]?.id);
  assertEqual(linked.data.institution, "GTBank", "completeBankLink returns sandbox account details");
  assertEqual(linked.data.mask, "3465", "account number is masked");

  // sign out wipes everything
  await session.signOut();
  state = session.getState();
  assertEqual(state.status, "signedOut", "signed out");
  assertEqual(state.user, null, "no user after sign out");
  assertEqual(state.workspaces.length, 0, "no workspaces after sign out");
  assertEqual(await store.get(), null, "token store cleared on sign out");
  assert(backend.calls.includes("POST /auth/logout"), "server session revoked on sign out");

  // a second user sees only their own data
  await session.register("bayo@example.com", "another-pass-2");
  await session.verify("123456");
  state = session.getState();
  assertEqual(state.user?.email, "bayo@example.com", "second user signed in");
  assert(state.workspaces.every((w) => w.id === "ws-u-bayo@example.com"), "no workspace from the first user");
  await session.signOut();

  // restoring from a stored token
  await session.signIn("ada@example.com", "correct-horse-1");
  const fresh = new SessionCore(api, store);
  await fresh.restore();
  assertEqual(fresh.getState().user?.email, "ada@example.com", "restore signs back in from the stored token");

  // a revoked stored token lands signed out and is cleared
  backend.refreshTokens.clear();
  const stale = new SessionCore(api, store);
  await stale.restore();
  assertEqual(stale.getState().status, "signedOut", "revoked token means signed out");
  assertEqual(await store.get(), null, "revoked token removed from the store");

  // signing in before verifying routes to verification and resends the code
  await session.register("late@example.com", "late-password-3");
  const unverified = new SessionCore(api, memoryTokenStore());
  let routed = false;
  try {
    await unverified.signIn("late@example.com", "late-password-3");
  } catch (error) {
    routed = error instanceof UnverifiedEmailError;
  }
  assert(routed, "unverified sign-in asks for verification");
  assertEqual(unverified.getState().pendingEmail, "late@example.com", "pending email set for verification");
  assertEqual(await unverified.verify("123456"), "signedIn", "verify then signs in");

  // wrong password, offline, recovery
  let wrong = "";
  try {
    await new SessionCore(api, memoryTokenStore()).signIn("ada@example.com", "nope-nope-nope");
  } catch (error) {
    wrong = error instanceof Error ? error.message : "";
  }
  assertEqual(wrong, "That email and password don’t match.", "wrong password message");

  backend.setOffline(true);
  let offline = "";
  try {
    await new SessionCore(api, memoryTokenStore()).signIn("ada@example.com", "correct-horse-1");
  } catch (error) {
    offline = error instanceof ApiError && error.status === 0 ? error.message : "";
  }
  assert(offline.includes("Can’t reach MyLedja"), "offline message");
  backend.setOffline(false);

  const recovering = new SessionCore(api, memoryTokenStore());
  await recovering.startRecovery("ada@example.com");
  assertEqual(recovering.getState().pendingEmail, "ada@example.com", "recovery remembers the email");
  await recovering.confirmRecovery("123456", "brand-new-pass-4");
  assertEqual(recovering.getState().status, "signedOut", "reset leaves the device signed out");
  assertEqual(recovering.getState().pendingEmail, null, "reset clears the pending email");

  console.log("session-core: sign-up, verify, refresh, sign-out wipe, user switch, restore, recovery");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
