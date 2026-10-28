import { v7 as uuidv7 } from 'uuid';
import type { SessionStore } from '@/data/session';

export type ApiErrorBody = { code: string; message: string; field?: string; retryAfterSeconds?: number };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody,
  ) {
    super(body.code);
  }
}

export class NetworkError extends Error {
  constructor() {
    super('network');
  }
}

export type TransportRequest = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  path: string;
  headers: Record<string, string>;
  body?: unknown;
  /** Send the browser's HttpOnly refresh cookie (web "Stay signed in"). */
  withCredentials?: boolean;
};

export type TransportResponse = { status: number; body: unknown };
export type Transport = (req: TransportRequest) => Promise<TransportResponse>;

export const OPERATION_HEADER = 'X-Operation-Id';
/** Custom header the cookie refresh needs, so other sites can't use the cookie (TECH-SPEC 10). */
export const CSRF_HEADER = 'X-MyLedja-Client';

export function fetchTransport(baseUrl: string): Transport {
  return async (req) => {
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${req.path}`, {
        method: req.method,
        headers: { 'Content-Type': 'application/json', ...req.headers },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        credentials: req.withCredentials ? 'include' : 'omit',
      });
    } catch {
      throw new NetworkError();
    }
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

export type Tokens = { accessToken: string; refreshToken?: string | null };

const RETRY_WAITS_MS = [500, 1500];

export class ApiClient {
  private accessToken: string | null = null;
  private refreshing: Promise<boolean> | null = null;

  constructor(
    private transport: Transport,
    private session: SessionStore,
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {}

  setTransport(transport: Transport) {
    this.transport = transport;
  }

  async signedIn(tokens: Tokens, staySignedIn: boolean) {
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) await this.session.setRefreshToken(tokens.refreshToken);
    await this.session.setCookieSession(staySignedIn);
  }

  async signOut() {
    this.accessToken = null;
    await this.session.clear();
  }

  hasAccessToken() {
    return this.accessToken !== null;
  }

  /** Tries to get a new access token from what's stored. Returns false if signed out. */
  refresh(): Promise<boolean> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = null;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<boolean> {
    const refreshToken = await this.session.getRefreshToken();
    const cookie = await this.session.hasCookieSession();
    if (!refreshToken && !cookie) return false;
    const res = await this.transport({
      method: 'POST',
      path: '/v1/auth/refresh',
      headers: { [CSRF_HEADER]: '1' },
      body: refreshToken ? { refreshToken } : {},
      withCredentials: cookie,
    });
    if (res.status !== 200) {
      await this.signOut();
      return false;
    }
    const tokens = res.body as Tokens;
    this.accessToken = tokens.accessToken;
    if (tokens.refreshToken) await this.session.setRefreshToken(tokens.refreshToken);
    return true;
  }

  async request<T>(
    method: TransportRequest['method'],
    path: string,
    body?: unknown,
    options: { operationId?: string; auth?: boolean } = {},
  ): Promise<T> {
    const write = method !== 'GET';
    // One id for every retry of the same write, so the server runs it once.
    const operationId = write ? (options.operationId ?? uuidv7()) : undefined;
    const send = async () => {
      const headers: Record<string, string> = {};
      if (operationId) headers[OPERATION_HEADER] = operationId;
      if (options.auth !== false && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
      return this.withRetries(() => this.transport({ method, path, headers, body }));
    };

    let res = await send();
    if (res.status === 401 && options.auth !== false) {
      if (await this.refresh()) res = await send();
    }
    if (res.status >= 400) throw new ApiError(res.status, res.body as ApiErrorBody);
    return res.body as T;
  }

  private async withRetries(run: () => Promise<TransportResponse>): Promise<TransportResponse> {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await run();
        if (res.status >= 500 && attempt < RETRY_WAITS_MS.length) {
          await this.sleep(RETRY_WAITS_MS[attempt]!);
          continue;
        }
        return res;
      } catch (e) {
        if (e instanceof NetworkError && attempt < RETRY_WAITS_MS.length) {
          await this.sleep(RETRY_WAITS_MS[attempt]!);
          continue;
        }
        throw e;
      }
    }
  }
}
