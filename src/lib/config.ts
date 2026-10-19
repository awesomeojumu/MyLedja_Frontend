export interface PublicConfig {
  appEnv: string;
  apiUrl: string;
  monoPublicKey: string;
}

type EnvMap = Record<string, string | undefined>;

export function readPublicConfig(env: EnvMap = process.env): PublicConfig {
  return {
    appEnv: env.EXPO_PUBLIC_APP_ENV ?? "development",
    apiUrl: env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
    monoPublicKey: env.EXPO_PUBLIC_MONO_PUBLIC_KEY ?? "",
  };
}

const LIVE_API = "https://myledja-backend.onrender.com";
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Expo may drop Vercel env at export time, so hosted web still needs a real API. */
export function apiUrlForPageHost(hostname: string | undefined, apiUrl: string): string {
  if (!hostname) return apiUrl;
  if (hostname === "app.myledja.com") return LIVE_API;
  if (/^myledja-(web|app)(-[a-z0-9-]+)?\.vercel\.app$/.test(hostname)) return LIVE_API;
  return apiUrl;
}

/**
 * On a phone, "localhost" is the phone itself. In development, point a loopback API URL at the machine Expo
 * is serving from (its hostUri, e.g. "192.168.1.20:8081") so the same .env works in Expo Go.
 */
export function resolveApiUrl(apiUrl: string, hostUri?: string | null): string {
  const match = /^(https?:\/\/)([^/:]+|\[[^\]]+\])(:\d+)?(.*)$/.exec(apiUrl);
  if (!match || !hostUri) return apiUrl;
  const [, scheme, host, port = "", rest] = match;
  if (!LOOPBACK.has(host)) return apiUrl;
  const devHost = hostUri.split(":")[0];
  if (!devHost || LOOPBACK.has(devHost)) return apiUrl;
  return `${scheme}${devHost}${port}${rest}`;
}
