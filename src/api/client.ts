/** Thin client for the MyLedja API (/v1). No UI or storage concerns live here. */

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  userId: string;
  expiresIn: number;
}

export interface Me {
  userId: string;
  email: string;
  /** Lock-screen privacy (MYL-023). Missing means on. */
  hideLockScreenAmounts?: boolean;
  totpEnabled?: boolean;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export interface BankLinkStart {
  status: "ok";
  data: { monoUrl: string };
}

export interface LinkedBank {
  provider: "mono";
  institution: string;
  name: string;
  mask: string;
  balance: number;
  currency: string;
}

export interface BankLinkComplete {
  status: "ok";
  data: LinkedBank;
}

export interface HttpResponse {
  status: number;
  text(): Promise<string>;
}

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body?: string },
) => Promise<HttpResponse>;

/** status 0 means the server could not be reached. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class MfaRequiredError extends Error {
  constructor(readonly challengeId: string) {
    super("Enter your authenticator code.");
    this.name = "MfaRequiredError";
  }
}

const FRIENDLY: Record<string, string> = {
  "invalid credentials": "That email and password don’t match.",
  "email not verified": "Verify your email to finish setting up your account.",
  "too many attempts": "Too many attempts. Wait a few minutes and try again.",
  "invalid code": "That code is wrong or has expired. Request a new one.",
  "invalid refresh token": "Your session has ended. Sign in again.",
  "invalid access token": "Your session has ended. Sign in again.",
  "password is too common": "That password is too common. Choose another.",
  "password must be at least 10 characters": "Use at least 10 characters.",
  "password must not match the email": "Your password can’t be your email.",
  "email is invalid": "Enter a valid email address.",
  "Bank linking is not set up on this server.": "Bank linking is not set up on this server.",
  "That code is missing.": "Paste the code from Mono first.",
  "Could not reach Mono. Try again.": "Could not reach Mono. Try again.",
  "Mono could not complete that step.": "Mono could not complete that step.",
  "Refund needs the original transaction.": "Choose the expense you’re refunding.",
  "Only an expense can be refunded.": "Only an expense can be refunded.",
  "A refund can’t be more than what’s left of the original expense.": "That’s more than what’s left to refund on this expense.",
  "Already matched.": "Already matched",
  "Amount does not match.": "Amount does not match.",
  "Say who you owe.": "Say who you owe.",
  "Say who owes you.": "Say who owes you.",
  "direction required.": "Pick whether you owe them or they owe you.",
  "Principal is more than remaining.": "That’s more than what’s left on this debt.",
  "Amount is more than remaining.": "That’s more than what’s left on this debt.",
  "This person is not someone you owe.": "This person is not someone you owe.",
  "This person does not owe you.": "This person does not owe you.",
};

export function friendlyMessage(reason: string): string {
  return FRIENDLY[reason] ?? "Something went wrong. Try again.";
}

export function createApiClient(baseUrl: string, fetchImpl: FetchLike) {
  const root = `${baseUrl.replace(/\/+$/, "")}/v1`;

  async function call<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (token) headers.authorization = `Bearer ${token}`;
    let res: HttpResponse;
    try {
      res = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, "network", "Can’t reach MyLedja. Check your connection and try again.");
    }
    const text = await res.text();
    let json: unknown = null;
    try {
      json = text.length > 0 ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.status >= 400) {
      const rec = json && typeof json === "object" ? (json as { status?: unknown; data?: { challengeId?: string }; error?: unknown }) : {};
      if (rec.status === "mfa_required") {
        throw new MfaRequiredError(String(rec.data?.challengeId ?? ""));
      }
      const reason = typeof rec.error === "string" ? rec.error : `http ${res.status}`;
      throw new ApiError(res.status, reason, friendlyMessage(reason));
    }
    return json as T;
  }

  return {
    register: (email: string, password: string) =>
      call<{ status: "accepted" }>("POST", "/auth/register", { email, password }),
    verify: (email: string, code: string) =>
      call<{ status: "verified"; userId: string; workspaceId: string }>("POST", "/auth/verify", { email, code }),
    resendVerification: (email: string) =>
      call<{ status: "accepted" }>("POST", "/auth/verify/resend", { email }),
    login: (email: string, password: string) => call<Tokens>("POST", "/auth/login", { email, password }),
    completeMfa: (body: { challengeId: string; code?: string; backupCode?: string }) =>
      call<Tokens>("POST", "/auth/mfa", body),
    startTotp: (accessToken: string) =>
      call<{ status: "ok"; data: { otpauthUri: string; secret: string } }>("POST", "/me/mfa/totp/start", {}, accessToken),
    confirmTotp: (accessToken: string, code: string) =>
      call<{ status: "ok"; data: { backupCodes: string[] } }>("POST", "/me/mfa/totp/confirm", { code }, accessToken),
    disableTotp: (accessToken: string, code: string) =>
      call<{ status: "ok"; data: { totpEnabled: boolean } }>("POST", "/me/mfa/totp/disable", { code }, accessToken),
    passkeyStart: (accessToken: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("POST", "/me/passkeys/register/start", {}, accessToken),
    passkeyFinish: (accessToken: string, body: unknown) =>
      call<{ status: "ok"; data: { credentialId: string } }>("POST", "/me/passkeys/register/finish", body, accessToken),
    updateWorkspace: (accessToken: string, workspaceId: string, name: string) =>
      call<{ id: string; name: string }>("PATCH", `/workspaces/${workspaceId}`, { name }, accessToken),
    getCategory: (accessToken: string, workspaceId: string, categoryId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>(
        "GET",
        `/workspaces/${workspaceId}/categories/${categoryId}`,
        undefined,
        accessToken,
      ),
    createCategory: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/categories`, body, accessToken),
    patchCategory: (accessToken: string, workspaceId: string, categoryId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/categories/${categoryId}`, body, accessToken),
    getMerchant: (accessToken: string, workspaceId: string, merchantId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>(
        "GET",
        `/workspaces/${workspaceId}/merchants/${merchantId}`,
        undefined,
        accessToken,
      ),
    createMerchant: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/merchants`, body, accessToken),
    patchMerchant: (accessToken: string, workspaceId: string, merchantId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/merchants/${merchantId}`, body, accessToken),
    listBudgets: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/budgets`, undefined, accessToken),
    getBudget: (accessToken: string, workspaceId: string, budgetId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>(
        "GET",
        `/workspaces/${workspaceId}/budgets/${budgetId}`,
        undefined,
        accessToken,
      ),
    createBudget: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/budgets`, body, accessToken),
    patchBudget: (accessToken: string, workspaceId: string, budgetId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("PATCH", `/workspaces/${workspaceId}/budgets/${budgetId}`, body, accessToken),
    listBills: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/bills`, undefined, accessToken),
    getBill: (accessToken: string, workspaceId: string, billId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/bills/${billId}`, undefined, accessToken),
    createBill: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/bills`, body, accessToken),
    patchBill: (accessToken: string, workspaceId: string, billId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/bills/${billId}`, body, accessToken),
    markBillPaid: (accessToken: string, workspaceId: string, billId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/bills/${billId}/paid`, body, accessToken),
    listBillReminders: (accessToken: string, workspaceId: string, billId: string) =>
      call<{ status: "ok"; data: { dueDate: string; createdAt?: string }[] }>(
        "GET",
        `/workspaces/${workspaceId}/bills/${billId}/reminders`,
        undefined,
        accessToken,
      ),
    listIncomeStreams: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/income-streams`, undefined, accessToken),
    getIncomeStream: (accessToken: string, workspaceId: string, streamId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/income-streams/${streamId}`, undefined, accessToken),
    createIncomeStream: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/income-streams`, body, accessToken),
    patchIncomeStream: (accessToken: string, workspaceId: string, streamId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/income-streams/${streamId}`, body, accessToken),
    incomeStreamPeriod: (accessToken: string, workspaceId: string, streamId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/income-streams/${streamId}/period`, undefined, accessToken),
    matchIncome: (accessToken: string, workspaceId: string, streamId: string, transactionId: string) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/income-streams/${streamId}/match`, { transactionId }, accessToken),
    listGoals: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/goals`, undefined, accessToken),
    getGoal: (accessToken: string, workspaceId: string, goalId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/goals/${goalId}`, undefined, accessToken),
    createGoal: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/goals`, body, accessToken),
    patchGoal: (accessToken: string, workspaceId: string, goalId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/goals/${goalId}`, body, accessToken),
    allocateGoal: (accessToken: string, workspaceId: string, goalId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/goals/${goalId}/allocate`, body, accessToken),
    scheduleGoal: (accessToken: string, workspaceId: string, goalId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/goals/${goalId}/schedule`, body, accessToken),
    listHoldings: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/holdings`, undefined, accessToken),
    getHolding: (accessToken: string, workspaceId: string, holdingId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/holdings/${holdingId}`, undefined, accessToken),
    createHolding: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/holdings`, body, accessToken),
    patchHolding: (accessToken: string, workspaceId: string, holdingId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/holdings/${holdingId}`, body, accessToken),
    buyHolding: (accessToken: string, workspaceId: string, holdingId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/holdings/${holdingId}/buy`, body, accessToken),
    sellHolding: (accessToken: string, workspaceId: string, holdingId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/holdings/${holdingId}/sell`, body, accessToken),
    dividendHolding: (accessToken: string, workspaceId: string, holdingId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/holdings/${holdingId}/dividend`, body, accessToken),
    holdingPerformance: (accessToken: string, workspaceId: string, holdingId: string, from?: string, to?: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>(
        "GET",
        `/workspaces/${workspaceId}/holdings/${holdingId}/performance${from && to ? `?from=${from}&to=${to}` : ""}`,
        undefined,
        accessToken,
      ),
    listDebts: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: Record<string, unknown>[] }>("GET", `/workspaces/${workspaceId}/debts`, undefined, accessToken),
    getDebt: (accessToken: string, workspaceId: string, debtId: string) =>
      call<{ status: "ok"; data: Record<string, unknown> }>("GET", `/workspaces/${workspaceId}/debts/${debtId}`, undefined, accessToken),
    createDebt: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/debts`, body, accessToken),
    patchDebt: (accessToken: string, workspaceId: string, debtId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/debts/${debtId}`, body, accessToken),
    debtMove: (accessToken: string, workspaceId: string, debtId: string, kind: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/debts/${debtId}/${kind}`, body, accessToken),
    refresh: (refreshToken: string) => call<Tokens>("POST", "/auth/refresh", { refreshToken }),
    logout: (refreshToken: string) => call<{ status: "ok" }>("POST", "/auth/logout", { refreshToken }),
    startRecovery: (email: string) => call<{ status: "accepted" }>("POST", "/auth/recovery", { email }),
    confirmRecovery: (email: string, code: string, password: string) =>
      call<{ status: "reset" }>("POST", "/auth/recovery/confirm", { email, code, password }),
    me: (accessToken: string) => call<Me>("GET", "/auth/me", undefined, accessToken),
    workspaces: (accessToken: string) =>
      call<WorkspaceSummary[]>("GET", "/workspaces", undefined, accessToken),
    startBankLink: (accessToken: string, workspaceId?: string) =>
      call<BankLinkStart>("POST", "/bank-integrations/link", workspaceId ? { workspaceId } : {}, accessToken),
    completeBankLink: (accessToken: string, code: string, workspaceId?: string) =>
      call<BankLinkComplete>("POST", "/bank-integrations/link/complete", { code, workspaceId }, accessToken),
    listInstitutions: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: { id: string; name: string }[] }>(
        "GET",
        `/workspaces/${workspaceId}/institutions`,
        undefined,
        accessToken,
      ),
    createAccount: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { id: string } }>("POST", `/workspaces/${workspaceId}/accounts`, body, accessToken),
    listAccounts: (accessToken: string, workspaceId: string, archived = false) =>
      call<{ status: "ok"; data: unknown[] }>(
        "GET",
        `/workspaces/${workspaceId}/accounts${archived ? "?archived=true" : ""}`,
        undefined,
        accessToken,
      ),
    setOpening: (accessToken: string, workspaceId: string, accountId: string, opening: string) =>
      call<{ status: "ok"; data: unknown }>(
        "POST",
        `/workspaces/${workspaceId}/accounts/${accountId}/opening`,
        { opening },
        accessToken,
      ),
    setAccountKind: (accessToken: string, workspaceId: string, accountId: string, kind: string) =>
      call<{ status: "ok"; data: unknown }>(
        "POST",
        `/workspaces/${workspaceId}/accounts/${accountId}/kind`,
        { kind },
        accessToken,
      ),
    archiveAccount: (accessToken: string, workspaceId: string, accountId: string) =>
      call<{ status: "ok"; data: unknown }>("DELETE", `/workspaces/${workspaceId}/accounts/${accountId}`, undefined, accessToken),
    getAccount: (accessToken: string, workspaceId: string, accountId: string) =>
      call<{ status: "ok"; data: unknown }>(
        "GET",
        `/workspaces/${workspaceId}/accounts/${accountId}`,
        undefined,
        accessToken,
      ),
    renameAccount: (accessToken: string, workspaceId: string, accountId: string, name: string) =>
      call<{ status: "ok"; data: unknown }>(
        "PATCH",
        `/workspaces/${workspaceId}/accounts/${accountId}`,
        { name },
        accessToken,
      ),
    restoreAccount: (accessToken: string, workspaceId: string, accountId: string) =>
      call<{ status: "ok"; data: unknown }>(
        "POST",
        `/workspaces/${workspaceId}/accounts/${accountId}/restore`,
        {},
        accessToken,
      ),
    listReconciliations: (accessToken: string, workspaceId: string, accountId: string) =>
      call<{
        status: "ok";
        data: { at: string; external: string; calculated: string; difference: string; reconciled: boolean }[];
      }>("GET", `/workspaces/${workspaceId}/accounts/${accountId}/reconciliations`, undefined, accessToken),
    createTransaction: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/transactions`, body, accessToken),
    listTransactions: (accessToken: string, workspaceId: string) =>
      call<{
        status: "ok";
        data: {
          transactions: {
            id: string;
            description?: string;
            accountId?: string;
            toAccountId?: string | null;
            amount?: string;
            type?: string;
            status?: string;
            categoryId?: string | null;
            occurredAt?: string;
          }[];
        };
      }>(
        "GET",
        `/workspaces/${workspaceId}/transactions`,
        undefined,
        accessToken,
      ),
    listMerchants: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: { id: string; name: string }[] }>(
        "GET",
        `/workspaces/${workspaceId}/merchants`,
        undefined,
        accessToken,
      ),
    listCategories: (accessToken: string, workspaceId: string) =>
      call<{ status: "ok"; data: { id: string; name: string; kind: string; parentId?: string | null }[] }>(
        "GET",
        `/workspaces/${workspaceId}/categories`,
        undefined,
        accessToken,
      ),
    getWorkspace: (accessToken: string, workspaceId: string) =>
      call<{
        id: string;
        name?: string;
        setupProgress?: Record<string, boolean>;
        defaultCurrency?: string;
        reminders?: { bills?: boolean; budget?: boolean; summary?: boolean };
      }>(
        "GET",
        `/workspaces/${workspaceId}`,
        undefined,
        accessToken,
      ),
    previewRule: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: { transactionIds: string[] } }>(
        "POST",
        `/workspaces/${workspaceId}/rules/preview`,
        body,
        accessToken,
      ),
    patchSetup: (accessToken: string, workspaceId: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("PATCH", `/workspaces/${workspaceId}/setup`, body, accessToken),
    dashboard: (accessToken: string, workspaceId: string, from?: string, to?: string) =>
      call<{ status: "ok"; data: Record<string, { value: string; basis: string }> }>(
        "GET",
        `/workspaces/${workspaceId}/dashboard${from && to ? `?from=${from}&to=${to}` : ""}`,
        undefined,
        accessToken,
      ),
    search: (accessToken: string, workspaceId: string, q: string) =>
      call<{
        status: "ok";
        data: {
          transactions: { id: string; label: string; amount?: string; type?: string }[];
          accounts: { id: string; label: string }[];
          bills: { id: string; label: string }[];
          goals: { id: string; label: string }[];
          debts: { id: string; label: string }[];
        };
      }>("GET", `/workspaces/${workspaceId}/search?q=${encodeURIComponent(q)}`, undefined, accessToken),
    budgetViews: (accessToken: string, workspaceId: string, budgetId: string) =>
      call<{ status: "ok"; data: { spent: string; remaining: string; views: Record<string, { value: string; basis: string }> } }>(
        "GET",
        `/workspaces/${workspaceId}/budgets/${budgetId}`,
        undefined,
        accessToken,
      ),
    patchSettings: (accessToken: string, hideLockScreenAmounts: boolean) =>
      call<{ status: "ok"; data: { hideLockScreenAmounts: boolean } }>(
        "PATCH",
        "/me/settings",
        { hideLockScreenAmounts },
        accessToken,
      ),
    listCollection: (accessToken: string, workspaceId: string, path: string) =>
      call<{ status: "ok"; data: { id: string }[] }>("GET", `/workspaces/${workspaceId}/${path}`, undefined, accessToken),
    postCollection: (accessToken: string, workspaceId: string, path: string, body: unknown) =>
      call<{ status: "ok"; data: unknown }>("POST", `/workspaces/${workspaceId}/${path}`, body, accessToken),
    listSessions: (accessToken: string) =>
      call<{ status: "ok"; data: { id: string }[] }>("GET", "/me/sessions", undefined, accessToken),
    revokeSession: (accessToken: string, id: string) =>
      call<{ status: "ok"; data: { id: string } }>("DELETE", `/me/sessions/${id}`, undefined, accessToken),
    startDeletion: (accessToken: string) =>
      call<{ status: "ok"; data: { started: boolean } }>("POST", "/me/deletion", {}, accessToken),
    previewImport: (accessToken: string, workspaceId: string, text: string, accountId?: string) =>
      call<{ status: "ok"; data: { importId: string; accepted: unknown[]; rejected: unknown[] } }>(
        "POST",
        `/workspaces/${workspaceId}/imports/preview`,
        { text, accountId },
        accessToken,
      ),
    commitImport: (accessToken: string, workspaceId: string, importId: string, body: unknown) =>
      call<{ status: "ok"; data: { ids: string[] } }>(
        "POST",
        `/workspaces/${workspaceId}/imports/${importId}/commit`,
        body,
        accessToken,
      ),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
