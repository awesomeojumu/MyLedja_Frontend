# Beta artifacts (MYL-025)

## Build and submit

Profiles live in `eas.json` (`preview` + `production`). Submit profile `preview` targets Play internal and App Store Connect.

A human runs these on a signed-in EAS machine (this repo does not store store credentials):

1. `eas build --profile preview --platform all`
2. `eas submit --profile preview --platform all`

Store install (TestFlight / Play internal) is Track 1. This repo does not claim those installs are done.

## Production dependency audit

`npm run audit:prod` is the gate.

- Backend: `npm audit --omit=dev` must be 0.
- Frontend: `scripts/audit-prod.mjs` fails on any production GHSA except the two with **no patched release**:
  - `GHSA-vfj7-8cjw-p6xm` (`braces` through 3.0.3, via Metro / Expo)
  - `GHSA-86w9-cpqp-85rv` (`node-forge` through 1.4.0, via `@expo/code-signing-certificates`)
- `uuid` and `decode-uri-component` are pinned in `overrides` to patched versions.

CI also runs gitleaks (`detect --source=/repo --verbose --no-git`).
