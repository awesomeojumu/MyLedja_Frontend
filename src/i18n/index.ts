import en from './en.json';

export type TextKey = keyof typeof en;

export function t(key: TextKey, vars?: Record<string, string | number>): string {
  const template: string = en[key];
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

export const catalogue: Record<TextKey, string> = en;
