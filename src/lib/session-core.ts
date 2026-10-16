import { ApiError, type ApiClient, type BankLinkComplete, type BankLinkStart, type Me, type WorkspaceSummary } from "../api/client";

/** Where the refresh token lives. On devices this is Keychain / Keystore only (see secure-token-store). */
export interface TokenStore {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export function memoryTokenStore(): TokenStore {
  let value: string | null = null;
  return {
    get: async () => value,
    set: async (token) => {
      value = token;
    },
    clear: async () => {
      value = null;
    },
  };
}

export interface SessionState {
  status: "loading" | "signedOut" | "signedIn";
  user: Me | null;
  workspaces: WorkspaceSummary[];
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
      const tokens = await this.api.refresh(refreshToken);
      await this.adopt(tokens.accessToken, tokens.refreshToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 0) {
        // Offline at launch: keep the token for next time but do not pretend to be signed in.
        this.set(SIGNED_OUT);
        return;
      }
      await this.wipe();
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
        const tokens = await this.api.refresh(refreshToken);
        this.accessToken = tokens.accessToken;
        await this.store.set(tokens.refreshToken);
      } catch (refreshError) {
        await this.wipe();
        throw refreshError;
      }
      return run(this.accessToken);
    }
  }

  private async adopt(accessToken: string, refreshToken: string): Promise<void> {
    this.accessToken = accessToken;
    await this.store.set(refreshToken);
    const [user, workspaces] = await Promise.all([
      this.authed((token) => this.api.me(token)),
      this.authed((token) => this.api.workspaces(token)),
    ]);
    this.set({ status: "signedIn", user, workspaces, pendingEmail: null });
  }

  private async wipe(): Promise<void> {
    this.accessToken = null;
    this.pendingPassword = null;
    await this.store.clear();
    this.set(SIGNED_OUT);
  }
}
