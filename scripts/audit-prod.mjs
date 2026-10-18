import { spawnSync } from "node:child_process";

/** No patched release exists (braces ≤3.0.3, node-forge ≤1.4.0). Expo/Metro still pull both. */
const NO_FIX = new Set(["GHSA-vfj7-8cjw-p6xm", "GHSA-86w9-cpqp-85rv"]);

function report() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["audit", "--omit=dev", "--json"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const raw = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  const start = raw.indexOf("{");
  if (start < 0) {
    throw new Error(`npm audit produced no JSON (exit ${result.status})`);
  }
  return JSON.parse(raw.slice(start));
}

const data = report();
const ids = new Set();
for (const row of Object.values(data.vulnerabilities ?? {})) {
  for (const via of row.via ?? []) {
    if (via && typeof via === "object" && typeof via.url === "string") {
      const match = via.url.match(/GHSA-[a-z0-9-]+/i);
      if (match) ids.add(match[0]);
    }
  }
}
const found = [...ids].sort();
const unexpected = found.filter((id) => !NO_FIX.has(id));
const total = data.metadata?.vulnerabilities?.total ?? 0;
if (total > 0 && found.length === 0) {
  console.error("Could not read GHSA ids from npm audit.");
  process.exit(1);
}
if (unexpected.length > 0) {
  console.error("Unexpected production advisories:", unexpected.join(", "));
  process.exit(1);
}
for (const id of found) {
  console.log(`allowed (no upstream patch): ${id}`);
}
console.log("audit-prod: no unexpected production findings");
