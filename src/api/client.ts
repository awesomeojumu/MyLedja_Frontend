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
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  kind: string;
  role: "owner" | "admin" | "editor" | "viewer";
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
      const reason =
        json && typeof json === "object" && typeof (json as { error?: unknown }).error === "string"
          ? (json as { error: string }).error
          : `http ${res.status}`;
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
    refresh: (refreshToken: string) => call<Tokens>("POST", "/auth/refresh", { refreshToken }),
    logout: (refreshToken: string) => call<{ status: "ok" }>("POST", "/auth/logout", { refreshToken }),
    startRecovery: (email: string) => call<{ status: "accepted" }>("POST", "/auth/recovery", { email }),
    confirmRecovery: (email: string, code: string, password: string) =>
      call<{ status: "reset" }>("POST", "/auth/recovery/confirm", { email, code, password }),
    me: (accessToken: string) => call<Me>("GET", "/auth/me", undefined, accessToken),
    workspaces: (accessToken: string) =>
      call<WorkspaceSummary[]>("GET", "/workspaces", undefined, accessToken),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
