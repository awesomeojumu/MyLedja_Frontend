import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const FEATURES_ROOT = __dirname;

export const FEATURE_FOLDERS = [
  "auth-onboarding",
  "dashboard",
  "accounts",
  "transactions",
  "categories-merchants",
  "budgets",
  "bills",
  "plans-goals",
  "income",
  "debts",
  "savings",
  "investments",
  "taxes",
  "financial-health",
  "notifications",
  "settings-privacy",
  "help-support",
] as const;

const FEATURE_DIRS = [
  "screens",
  "components",
  "hooks",
  "services",
  "repositories",
  "schemas",
  "types",
  "__tests__",
] as const;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function walk(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else {
      files.push(full);
    }
  }
  return files;
}

function featureOf(file: string): string | undefined {
  const rel = relative(FEATURES_ROOT, file);
  const top = rel.split(sep)[0];
  return FEATURE_FOLDERS.find((name) => name === top);
}

function resolveImport(fromFile: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const base = resolve(dirname(fromFile), spec);
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
    base,
  ];
  return candidates.find((path) => existsSync(path));
}

assertEqual(FEATURE_FOLDERS.length, 17);

for (const name of FEATURE_FOLDERS) {
  const root = join(FEATURES_ROOT, name);
  assert(existsSync(join(root, "index.ts")), `${name} must expose index.ts as its public door`);
  for (const dir of FEATURE_DIRS) {
    assert(existsSync(join(root, dir)), `${name} must have ${dir}/`);
  }
}

const sources = walk(FEATURES_ROOT).filter((file) => {
  if (file.endsWith("boundaries.test.ts")) return false;
  if (!/\.(ts|tsx)$/.test(file)) return false;
  if (file.includes(`${sep}__tests__${sep}`)) return false;
  return true;
});

const importRe = /from\s+["']([^"']+)["']/g;

for (const file of sources) {
  const fromFeature = featureOf(file);
  if (!fromFeature) continue;
  const content = readFileSync(file, "utf8");
  for (const match of content.matchAll(importRe)) {
    const resolved = resolveImport(file, match[1]);
    if (!resolved) continue;
    const toFeature = featureOf(resolved);
    if (!toFeature || toFeature === fromFeature) continue;
    const door = join(FEATURES_ROOT, toFeature, "index.ts");
    const doorTsx = join(FEATURES_ROOT, toFeature, "index.tsx");
    assert(
      resolved === door || resolved === doorTsx,
      `${relative(FEATURES_ROOT, file)} must import ${toFeature} through index.ts (got ${relative(FEATURES_ROOT, resolved)})`,
    );
  }
}

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

console.log("features: 17 folders, required dirs, and public-door imports hold");
