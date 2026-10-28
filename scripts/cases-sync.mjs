// npm run cases:sync [-- --from <path>] copies the backend's ledger-cases.json and .sha256
// (default ../myledja_backend/test/fixtures/). BUILD-PLAN 1.3 / TECH-SPEC 6.12: both repos
// keep identical bytes; the backend owns the file and the app copies it.
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const destDir = resolve(root, 'test/fixtures');
const fromIndex = process.argv.indexOf('--from');
const backendDir =
  fromIndex > -1
    ? resolve(process.argv[fromIndex + 1])
    : resolve(root, '../myledja_backend/test/fixtures');

const srcJson = resolve(backendDir, 'ledger-cases.json');
const srcSum = resolve(backendDir, 'ledger-cases.sha256');
if (!existsSync(srcJson) || !existsSync(srcSum)) {
  console.error(`cases:sync: ${srcJson} and ${srcSum} must both exist.`);
  process.exit(1);
}
copyFileSync(srcJson, resolve(destDir, 'ledger-cases.json'));
copyFileSync(srcSum, resolve(destDir, 'ledger-cases.sha256'));
console.log('cases:sync: copied ledger-cases.json and ledger-cases.sha256 from', backendDir);
