import { z } from 'zod';

export const appEnvSchema = z.enum(['development', 'staging', 'production']);
export type AppEnv = z.infer<typeof appEnvSchema>;

export type AppConfig = {
  appEnv: AppEnv;
  apiUrl: string | null;
  monoPublicKey: string | null;
  /** Figma overhaul; default off. Optional — never a config problem. */
  redesign: boolean;
  problems: string[];
};

type RawEnv = {
  EXPO_PUBLIC_APP_ENV?: string;
  EXPO_PUBLIC_API_URL?: string;
  EXPO_PUBLIC_MONO_PUBLIC_KEY?: string;
  EXPO_PUBLIC_REDESIGN?: string;
};

function parseRedesignFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

/** Problems name the variable, never its value. */
export function readConfig(raw: RawEnv): AppConfig {
  const problems: string[] = [];
  const envParsed = appEnvSchema.safeParse(raw.EXPO_PUBLIC_APP_ENV || 'development');
  if (!envParsed.success) problems.push('EXPO_PUBLIC_APP_ENV');
  const appEnv: AppEnv = envParsed.success ? envParsed.data : 'development';

  let apiUrl: string | null = null;
  const urlRaw = raw.EXPO_PUBLIC_API_URL?.trim();
  if (!urlRaw) problems.push('EXPO_PUBLIC_API_URL');
  else if (!z.string().url().safeParse(urlRaw).success) problems.push('EXPO_PUBLIC_API_URL');
  else apiUrl = urlRaw.replace(/\/+$/, '');

  const monoPublicKey = raw.EXPO_PUBLIC_MONO_PUBLIC_KEY?.trim() || null;
  const redesign = parseRedesignFlag(raw.EXPO_PUBLIC_REDESIGN);
  return { appEnv, apiUrl, monoPublicKey, redesign, problems };
}

// Expo inlines EXPO_PUBLIC_ variables only when they're read with this exact syntax.
export const config: AppConfig = readConfig({
  EXPO_PUBLIC_APP_ENV: process.env.EXPO_PUBLIC_APP_ENV,
  EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL,
  EXPO_PUBLIC_MONO_PUBLIC_KEY: process.env.EXPO_PUBLIC_MONO_PUBLIC_KEY,
  EXPO_PUBLIC_REDESIGN: process.env.EXPO_PUBLIC_REDESIGN,
});

export const features = {
  mono: config.monoPublicKey !== null,
  redesign: config.redesign,
};
