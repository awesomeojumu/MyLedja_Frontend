import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { colors, type ColorTokens } from "@/design/tokens";
import { contrastRatio, parseHex } from "@/design/contrast";
import {
  EXEMPT_COMPONENTS,
  HELPER_EXPORTS,
  PAIRS,
  type ContrastPair,
} from "@/design/contrast-pairs";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

const frontendRoot = process.cwd();
const componentFiles = [
  "src/design/components/foundations.tsx",
  "src/design/components/actions.tsx",
  "src/design/components/surfaces.tsx",
  "src/design/components/inputs.tsx",
  "src/design/components/money.tsx",
  "src/design/components/data.tsx",
  "src/design/components/navigation.tsx",
  "src/design/motion.tsx",
];

function visualExports(): string[] {
  const names = new Set<string>();
  const re = /export function ([A-Z][A-Za-z0-9]+)/g;
  for (const file of componentFiles) {
    const src = readFileSync(join(frontendRoot, file), "utf8");
    let match: RegExpExecArray | null;
    while ((match = re.exec(src))) {
      names.add(match[1]);
    }
  }
  return [...names].sort();
}

const TEXT_MIN = 4.5;
const UI_MIN = 3;

type Row = {
  component: string;
  state: string;
  theme: "light" | "dark";
  fg: string;
  bg: string;
  ratio: number;
  min: number;
  pass: boolean;
};

function measure(pair: ContrastPair, theme: "light" | "dark"): Row {
  const palette = colors[theme] as ColorTokens;
  const fg = palette[pair.fg];
  const bg = palette[pair.bg];
  const ratio = contrastRatio(parseHex(fg), parseHex(bg));
  const min = pair.role === "text" ? TEXT_MIN : pair.role === "ui" ? UI_MIN : 0;
  return {
    component: pair.component,
    state: pair.state,
    theme,
    fg: `${pair.fg} ${fg}`,
    bg: `${pair.bg} ${bg}`,
    ratio: Math.round(ratio * 100) / 100,
    min,
    pass: ratio + 1e-9 >= min,
  };
}

const visuals = visualExports();
const covered = new Set(PAIRS.map((pair) => pair.component));
for (const name of visuals) {
  if (HELPER_EXPORTS.has(name)) continue;
  assert(
    covered.has(name) || name in EXEMPT_COMPONENTS,
    `Visual export ${name} is missing from the contrast matrix`,
  );
}

const catalog = readFileSync(join(frontendRoot, "src/catalog/DesignCatalog.tsx"), "utf8");
for (const name of visuals) {
  if (HELPER_EXPORTS.has(name) || name in EXEMPT_COMPONENTS) continue;
  assert(catalog.includes(`<${name}`), `${name} is not rendered in the design catalog`);
}

const rows: Row[] = [];
for (const pair of PAIRS) {
  rows.push(measure(pair, "light"));
  rows.push(measure(pair, "dark"));
}

const failed = rows.filter((row) => !row.pass);
const result = {
  generatedAt: "2026-10-15",
  thresholds: { text: TEXT_MIN, ui: UI_MIN },
  exemptions: Object.entries(EXEMPT_COMPONENTS).map(([component, reason]) => ({
    component,
    reason,
  })),
  passed: rows.filter((row) => row.pass).length,
  failed: failed.length,
  results: rows,
};

writeFileSync(
  join(frontendRoot, "src/design/contrast-results.json"),
  `${JSON.stringify(result, null, 2)}\n`,
);

if (failed.length) {
  const sample = failed
    .slice(0, 12)
    .map((row) => `${row.component} ${row.state} ${row.theme} ${row.ratio}:1 (need ${row.min}:1)`)
    .join("\n");
  throw new Error(`${failed.length} contrast pairs failed:\n${sample}`);
}

assert(rows.length > 0, "Contrast matrix is empty");
assert(Math.abs(contrastRatio(parseHex("#000000"), parseHex("#ffffff")) - 21) < 0.01, "Black on white must be 21:1");
assert(
  PAIRS.some((pair) => pair.role === "hairline"),
  "Hairline pairs must be recorded even when they are not gated",
);
console.log(`contrast: ${rows.length} pairs passed in light and dark`);
