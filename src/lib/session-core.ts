import { ApiError, type ApiClient, type BankLinkComplete, type BankLinkStart, type Me, type WorkspaceSummary } from "@/api/client";
import { readCache, removeCache, writeCache } from "@/lib/offline-cache";

/** Who was last signed in on this device, so an offline launch can open the app instead of Welcome. */
const IDENTITY_KEY = "myledja.session.identity";
export type Identity = { user: Me; workspaces: WorkspaceSummary[] };

export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof ApiError && error.status === 0) return true;
  if (error instanceof TypeError) return true;
  return error instanceof Error && /failed to fetch|network request failed/i.test(error.message);
}

/** Where the refresh token and last signed-in identity live. On devices this is Keychain / Keystore only. */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
  getIdentity?(): Promise<Identity | null>;
  setIdentity?(identity: Identity): Promise<void>;
}

let inFlightRefresh: Promise<{ accessToken: string; refreshToken: string }> | null = null;

/** One refresh at a time per tab. Two restores (React Strict Mode) must not rotate the same token twice. */
export async function exchangeRefresh(
  api: Pick<ApiClient, "refresh">,
  store: TokenStore,
): Promise<{ accessToken: string; refreshToken: string }> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    const refreshToken = await store.get();
    if (!refreshToken) throw new ApiError(401, "invalid refresh token", "Sign in again.");
    const tokens = await api.refresh(refreshToken);
    await store.set(tokens.refreshToken);
    return tokens;
  })().finally(() => {
    inFlightRefresh = null;
  });
  return inFlightRefresh;
}

export function memoryTokenStore(): TokenStore {
  let value: string | null = null;
  let identity: Identity | null = null;
  return {
    get: async () => value,
    set: async (token) => {
      value = token;
    },
    clear: async () => {
      value = null;
      identity = null;
    },
    getIdentity: async () => identity,
    setIdentity: async (next) => {
      identity = next;
    },
  };
}

export interface SessionState {
  status: "loading" | "signedOut" | "signedIn";
  user: Me | null;
  workspaces: WorkspaceSummary[];
  /** Signed in from this device's saved identity while the server can't be reached. Screens show cached data. */
  offline?: boolean;
  /** Email waiting for a verification or recovery code. Never a password. */
  pendingEmail: string | null;
}

const SIGNED_OUT: SessionState = { status: "signedOut", user: null, workspaces: [], pendingEmail: null };

export class UnverifiedEmailError extends Error {
  constructor() {
    super("Verify your email to finish setting up your account.");
    this.name = "UnverifiedEmailError";
  }
}

/**
 * Owns the signed-in user. The access token stays in memory; only the refresh token is persisted, through
 * the TokenStore. Signing out wipes both and every user-scoped value, so the next user starts clean.
 */
export class SessionCore {
  private reconnecting = false;
  private state: SessionState = { ...SIGNED_OUT, status: "loading" };
  private accessToken: string | null = null;
  /** Held only between sign-up and verification so we can sign in right after; cleared straight away. */
  private pendingPassword: string | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly api: ApiClient,
    private readonly store: TokenStore,
  ) {}

  getState = (): SessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(next: SessionState): void {
    this.state = next;
    for (const listener of this.listeners) listener();
  }

  /** On launch: trade a stored refresh token for a fresh session, or land signed out. */
  async restore(): Promise<void> {
    const refreshToken = await this.store.get();
    if (!refreshToken) {
      this.set(SIGNED_OUT);
      return;
    }
    try {
      const tokens = await exchangeRefresh(this.api, this.store);
      await this.adopt(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      if (isNetworkFailure(error)) {
        const saved = await this.readIdentity();
        if (saved?.user) {
          this.set({ status: "signedIn", user: saved.user, workspaces: saved.workspaces ?? [], pendingEmail: null, offline: true });
          return;
        }
        // Token is still valid locally. Stay off Welcome and retry when the network returns.
        this.set({ status: "signedIn", user: null, workspaces: [], pendingEmail: null, offline: true });
        return;
      }
      await this.wipe();
    }
  }

  /**
   * Turns an offline launch into a live session once the server answers. A network failure leaves the session as
   * it is; only a real refusal (revoked or expired refresh token) signs the user out.
   */
  async reconnect(): Promise<boolean> {
    if (!this.state.offline || this.reconnecting) return !this.state.offline;
    this.reconnecting = true;
    try {
      const refreshToken = await this.store.get();
      if (!refreshToken) {
        await this.wipe();
        return false;
      }
      const tokens = await exchangeRefresh(this.api, this.store);
      await this.adopt(tokens.accessToken, tokens.refreshToken);
      return true;
    } catch (error) {
      if (!isNetworkFailure(error)) await this.wipe();
      return false;
    } finally {
      this.reconnecting = false;
    }
  }

  async register(email: string, password: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    await this.api.register(clean, password);
    this.pendingPassword = password;
    this.set({ ...this.state, pendingEmail: clean });
  }

  async resendVerification(): Promise<void> {
    if (!this.state.pendingEmail) return;
    await this.api.resendVerification(this.state.pendingEmail);
  }

  /** Verifies the code and, when we still hold the sign-up password, signs straight in. */
  async verify(code: string): Promise<"signedIn" | "needsSignIn"> {
    const email = this.state.pendingEmail;
    if (!email) throw new ApiError(400, "no pending email", "Start again from sign up.");
    await this.api.verify(email, code);
    const password = this.pendingPassword;
    this.pendingPassword = null;
    if (!password) {
      this.set({ ...this.state, pendingEmail: null });
      return "needsSignIn";
    }
    await this.signIn(email, password);
    return "signedIn";
  }

  async signIn(email: string, password: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    try {
      const tokens = await this.api.login(clean, password);
      this.pendingPassword = null;
      await this.adopt(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      if (error instanceof ApiError && error.reason === "email not verified") {
        this.pendingPassword = password;
        this.set({ ...this.state, pendingEmail: clean });
        await this.api.resendVerification(clean);
        throw new UnverifiedEmailError();
      }
      throw error;
    }
  }

  async startRecovery(email: string): Promise<void> {
    const clean = email.trim().toLowerCase();
    await this.api.startRecovery(clean);
    this.set({ ...this.state, pendingEmail: clean });
  }

  async confirmRecovery(code: string, password: string): Promise<void> {
    const email = this.state.pendingEmail;
    if (!email) throw new ApiError(400, "no pending email", "Start again from reset password.");
    await this.api.confirmRecovery(email, code, password);
    await this.wipe();
  }

  startBankLink(workspaceId?: string): Promise<BankLinkStart> {
    return this.authed((token) => this.api.startBankLink(token, workspaceId));
  }

  completeBankLink(code: string, workspaceId?: string): Promise<BankLinkComplete> {
    return this.authed((token) => this.api.completeBankLink(token, code, workspaceId));
  }

  async signOut(): Promise<void> {
    const refreshToken = await this.store.get();
    if (refreshToken) {
      try {
        await this.api.logout(refreshToken);
      } catch {
        // The local wipe below still signs this device out.
      }
    }
    await this.wipe();
  }

  /** Runs an authenticated call, refreshing once if the access token has expired. */
  async authed<T>(run: (accessToken: string) => Promise<T>): Promise<T> {
    if (!this.accessToken && this.state.offline) {
      await this.reconnect();
      if (!this.accessToken) throw new ApiError(0, "network", "Can’t reach MyLedja. Check your connection and try again.");
    }
    if (!this.accessToken) throw new ApiError(401, "invalid access token", "Sign in again.");
    try {
      return await run(this.accessToken);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const refreshToken = await this.store.get();
      if (!refreshToken) {
        await this.wipe();
        throw error;
      }
      try {
        const tokens = await exchangeRefresh(this.api, this.store);
        this.accessToken = tokens.accessToken;
      } catch (refreshError) {
        // A dropped connection is not a sign-out; only the server refusing the refresh token is.
        if (!isNetworkFailure(refreshError)) await this.wipe();
        throw refreshError;
      }
      return run(this.accessToken);
    }
  }

  listInstitutions(workspaceId: string) {
    return this.authed((token) => this.api.listInstitutions(token, workspaceId));
  }

  createAccount(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createAccount(token, workspaceId, body));
  }

  listAccounts(workspaceId: string, archived = false) {
    return this.authed((token) => this.api.listAccounts(token, workspaceId, archived));
  }

  setOpening(workspaceId: string, accountId: string, opening: string) {
    return this.authed((token) => this.api.setOpening(token, workspaceId, accountId, opening));
  }

  setAccountKind(workspaceId: string, accountId: string, kind: string) {
    return this.authed((token) => this.api.setAccountKind(token, workspaceId, accountId, kind));
  }

  archiveAccount(workspaceId: string, accountId: string) {
    return this.authed((token) => this.api.archiveAccount(token, workspaceId, accountId));
  }

  getAccount(workspaceId: string, accountId: string) {
    return this.authed((token) => this.api.getAccount(token, workspaceId, accountId));
  }

  renameAccount(workspaceId: string, accountId: string, name: string) {
    return this.authed((token) => this.api.renameAccount(token, workspaceId, accountId, name));
  }

  restoreAccount(workspaceId: string, accountId: string) {
    return this.authed((token) => this.api.restoreAccount(token, workspaceId, accountId));
  }

  listReconciliations(workspaceId: string, accountId: string) {
    return this.authed((token) => this.api.listReconciliations(token, workspaceId, accountId));
  }

  createTransaction(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createTransaction(token, workspaceId, body));
  }

  listTransactions(workspaceId: string) {
    return this.authed((token) => this.api.listTransactions(token, workspaceId));
  }

  setTransactionStatus(workspaceId: string, transactionId: string, status: string) {
    return this.authed((token) => this.api.setTransactionStatus(token, workspaceId, transactionId, status));
  }

  listMerchants(workspaceId: string) {
    return this.authed((token) => this.api.listMerchants(token, workspaceId));
  }

  listCategories(workspaceId: string) {
    return this.authed((token) => this.api.listCategories(token, workspaceId));
  }

  getWorkspace(workspaceId: string) {
    return this.authed((token) => this.api.getWorkspace(token, workspaceId));
  }

  patchSetup(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.patchSetup(token, workspaceId, body));
  }

  previewRule(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.previewRule(token, workspaceId, body));
  }

  dashboard(workspaceId: string, from?: string, to?: string) {
    return this.authed((token) => this.api.dashboard(token, workspaceId, from, to));
  }

  search(workspaceId: string, q: string) {
    return this.authed((token) => this.api.search(token, workspaceId, q));
  }

  budgetViews(workspaceId: string, budgetId: string) {
    return this.authed((token) => this.api.budgetViews(token, workspaceId, budgetId));
  }

  async patchSettings(hideLockScreenAmounts: boolean) {
    const res = await this.authed((token) => this.api.patchSettings(token, hideLockScreenAmounts));
    const { user, workspaces } = this.state;
    if (user) {
      const next = { ...user, hideLockScreenAmounts: res.data.hideLockScreenAmounts };
      this.set({ ...this.state, user: next });
      const identity = { user: next, workspaces } satisfies Identity;
      writeCache(IDENTITY_KEY, identity);
      await this.store.setIdentity?.(identity);
    }
    return res;
  }

  listCollection(workspaceId: string, path: string) {
    return this.authed((token) => this.api.listCollection(token, workspaceId, path));
  }

  postCollection(workspaceId: string, path: string, body: unknown) {
    return this.authed((token) => this.api.postCollection(token, workspaceId, path, body));
  }

  listSessions() {
    return this.authed((token) => this.api.listSessions(token));
  }

  revokeSession(id: string) {
    return this.authed((token) => this.api.revokeSession(token, id));
  }

  startDeletion() {
    return this.authed((token) => this.api.startDeletion(token));
  }

  previewImport(workspaceId: string, text: string, accountId?: string) {
    return this.authed((token) => this.api.previewImport(token, workspaceId, text, accountId));
  }

  commitImport(workspaceId: string, importId: string, body: unknown) {
    return this.authed((token) => this.api.commitImport(token, workspaceId, importId, body));
  }

  async completeMfa(body: { challengeId: string; code?: string; backupCode?: string }) {
    const tokens = await this.api.completeMfa(body);
    await this.adopt(tokens.accessToken, tokens.refreshToken);
  }

  startTotp() {
    return this.authed((token) => this.api.startTotp(token));
  }

  confirmTotp(code: string) {
    return this.authed((token) => this.api.confirmTotp(token, code));
  }

  disableTotp(code: string) {
    return this.authed((token) => this.api.disableTotp(token, code));
  }

  passkeyStart() {
    return this.authed((token) => this.api.passkeyStart(token));
  }

  passkeyFinish(body: unknown) {
    return this.authed((token) => this.api.passkeyFinish(token, body));
  }

  updateWorkspace(workspaceId: string, name: string) {
    return this.authed((token) => this.api.updateWorkspace(token, workspaceId, name));
  }

  getCategory(workspaceId: string, categoryId: string) {
    return this.authed((token) => this.api.getCategory(token, workspaceId, categoryId));
  }

  createCategory(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createCategory(token, workspaceId, body));
  }

  listCategoryGroups(workspaceId: string) {
    return this.authed((token) => this.api.listCategoryGroups(token, workspaceId));
  }

  createCategoryGroup(workspaceId: string, body: { name: string; kind?: string }) {
    return this.authed((token) => this.api.createCategoryGroup(token, workspaceId, body));
  }

  renameCategoryGroup(workspaceId: string, groupId: string, name: string) {
    return this.authed((token) => this.api.renameCategoryGroup(token, workspaceId, groupId, name));
  }

  deleteCategoryGroup(workspaceId: string, groupId: string) {
    return this.authed((token) => this.api.deleteCategoryGroup(token, workspaceId, groupId));
  }

  deleteCategory(workspaceId: string, categoryId: string, moveTo: string | null) {
    return this.authed((token) => this.api.deleteCategory(token, workspaceId, categoryId, moveTo));
  }

  listMonthHistory(workspaceId: string, limit = 6) {
    return this.authed((token) => this.api.listMonthHistory(token, workspaceId, limit));
  }

  patchCategory(workspaceId: string, categoryId: string, body: unknown) {
    return this.authed((token) => this.api.patchCategory(token, workspaceId, categoryId, body));
  }

  getMerchant(workspaceId: string, merchantId: string) {
    return this.authed((token) => this.api.getMerchant(token, workspaceId, merchantId));
  }

  createMerchant(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createMerchant(token, workspaceId, body));
  }

  patchMerchant(workspaceId: string, merchantId: string, body: unknown) {
    return this.authed((token) => this.api.patchMerchant(token, workspaceId, merchantId, body));
  }

  getMonthBudget(workspaceId: string, month: string) {
    return this.authed((token) => this.api.getMonthBudget(token, workspaceId, month));
  }

  setMonthLines(workspaceId: string, month: string, lines: { categoryId: string; amount: string }[]) {
    return this.authed((token) => this.api.setMonthLines(token, workspaceId, month, lines));
  }

  listBudgets(workspaceId: string) {
    return this.authed((token) => this.api.listBudgets(token, workspaceId));
  }

  getBudget(workspaceId: string, budgetId: string) {
    return this.authed((token) => this.api.getBudget(token, workspaceId, budgetId));
  }

  createBudget(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createBudget(token, workspaceId, body));
  }

  patchBudget(workspaceId: string, budgetId: string, body: unknown) {
    return this.authed((token) => this.api.patchBudget(token, workspaceId, budgetId, body));
  }

  listBills(workspaceId: string) {
    return this.authed((token) => this.api.listBills(token, workspaceId));
  }

  getBill(workspaceId: string, billId: string) {
    return this.authed((token) => this.api.getBill(token, workspaceId, billId));
  }

  createBill(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createBill(token, workspaceId, body));
  }

  patchBill(workspaceId: string, billId: string, body: unknown) {
    return this.authed((token) => this.api.patchBill(token, workspaceId, billId, body));
  }

  markBillPaid(workspaceId: string, billId: string, body: unknown) {
    return this.authed((token) => this.api.markBillPaid(token, workspaceId, billId, body));
  }

  listBillReminders(workspaceId: string, billId: string) {
    return this.authed((token) => this.api.listBillReminders(token, workspaceId, billId));
  }

  listIncomeStreams(workspaceId: string) {
    return this.authed((token) => this.api.listIncomeStreams(token, workspaceId));
  }

  getIncomeStream(workspaceId: string, streamId: string) {
    return this.authed((token) => this.api.getIncomeStream(token, workspaceId, streamId));
  }

  createIncomeStream(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createIncomeStream(token, workspaceId, body));
  }

  patchIncomeStream(workspaceId: string, streamId: string, body: unknown) {
    return this.authed((token) => this.api.patchIncomeStream(token, workspaceId, streamId, body));
  }

  incomeStreamPeriod(workspaceId: string, streamId: string) {
    return this.authed((token) => this.api.incomeStreamPeriod(token, workspaceId, streamId));
  }

  matchIncome(workspaceId: string, streamId: string, transactionId: string) {
    return this.authed((token) => this.api.matchIncome(token, workspaceId, streamId, transactionId));
  }

  listGoals(workspaceId: string) {
    return this.authed((token) => this.api.listGoals(token, workspaceId));
  }

  getGoal(workspaceId: string, goalId: string) {
    return this.authed((token) => this.api.getGoal(token, workspaceId, goalId));
  }

  createGoal(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createGoal(token, workspaceId, body));
  }

  patchGoal(workspaceId: string, goalId: string, body: unknown) {
    return this.authed((token) => this.api.patchGoal(token, workspaceId, goalId, body));
  }

  allocateGoal(workspaceId: string, goalId: string, body: unknown) {
    return this.authed((token) => this.api.allocateGoal(token, workspaceId, goalId, body));
  }

  scheduleGoal(workspaceId: string, goalId: string, body: unknown) {
    return this.authed((token) => this.api.scheduleGoal(token, workspaceId, goalId, body));
  }

  listHoldings(workspaceId: string) {
    return this.authed((token) => this.api.listHoldings(token, workspaceId));
  }

  getHolding(workspaceId: string, holdingId: string) {
    return this.authed((token) => this.api.getHolding(token, workspaceId, holdingId));
  }

  createHolding(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createHolding(token, workspaceId, body));
  }

  patchHolding(workspaceId: string, holdingId: string, body: unknown) {
    return this.authed((token) => this.api.patchHolding(token, workspaceId, holdingId, body));
  }

  buyHolding(workspaceId: string, holdingId: string, body: unknown) {
    return this.authed((token) => this.api.buyHolding(token, workspaceId, holdingId, body));
  }

  sellHolding(workspaceId: string, holdingId: string, body: unknown) {
    return this.authed((token) => this.api.sellHolding(token, workspaceId, holdingId, body));
  }

  dividendHolding(workspaceId: string, holdingId: string, body: unknown) {
    return this.authed((token) => this.api.dividendHolding(token, workspaceId, holdingId, body));
  }

  holdingPerformance(workspaceId: string, holdingId: string, from?: string, to?: string) {
    return this.authed((token) => this.api.holdingPerformance(token, workspaceId, holdingId, from, to));
  }

  listDebts(workspaceId: string) {
    return this.authed((token) => this.api.listDebts(token, workspaceId));
  }

  getDebt(workspaceId: string, debtId: string) {
    return this.authed((token) => this.api.getDebt(token, workspaceId, debtId));
  }

  createDebt(workspaceId: string, body: unknown) {
    return this.authed((token) => this.api.createDebt(token, workspaceId, body));
  }

  patchDebt(workspaceId: string, debtId: string, body: unknown) {
    return this.authed((token) => this.api.patchDebt(token, workspaceId, debtId, body));
  }

  debtMove(workspaceId: string, debtId: string, kind: string, body: unknown) {
    return this.authed((token) => this.api.debtMove(token, workspaceId, debtId, kind, body));
  }

  private async adopt(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    await this.store.set(refreshToken);
    const [user, workspaces] = await Promise.all([
      this.authed((token) => this.api.me(token)),
      this.authed((token) => this.api.workspaces(token)),
    ]);
    this.set({ status: "signedIn", user, workspaces, pendingEmail: null, offline: false });
    const identity = { user, workspaces } satisfies Identity;
    writeCache(IDENTITY_KEY, identity);
    await this.store.setIdentity?.(identity);
    try {
      const { primeUserOutbox } = await import("@/sync/user-outbox");
      await primeUserOutbox(user.userId);
    } catch {
      /* SQLite engine missing in some test hosts; memory store hydrates when it can. */
    }
  }

  private async wipe(): Promise<void> {
    this.accessToken = null;
    this.pendingPassword = null;
    removeCache(IDENTITY_KEY);
    await this.store.clear();
    this.set(SIGNED_OUT);
  }

  private async readIdentity(): Promise<Identity | null> {
    const fromStore = await this.store.getIdentity?.();
    if (fromStore?.user) return fromStore;
    return readCache<Identity>(IDENTITY_KEY);
  }
}
