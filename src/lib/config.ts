export interface PublicConfig {
  appEnv: string;
  apiUrl: string;
}

type EnvMap = Record<string, string | undefined>;

export function readPublicConfig(env: EnvMap = process.env): PublicConfig {
  return {
    appEnv: env.EXPO_PUBLIC_APP_ENV ?? "development",
    apiUrl: env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000",
  };
}
