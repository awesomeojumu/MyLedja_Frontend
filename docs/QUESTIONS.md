# Questions

Format and rules: build plan section 14. Each open question stops only the task it names.

## Q-1: Dark theme helper text fails contrast on hover rows
- Task: F0.3
- Raised by: frontend agent
- Documents: DESIGN.md 2.1 (Dark column: helper text `hairline-input` #8494AB, hover row #132F4C); build plan F0.3 (every text and background pair passes WCAG AA)
- Options: A, use `primary-bg-subdued-hover` (#DCE3EE) for helper text on dark hover rows and table headers only (10.9:1). B, lighten the dark hover colour (it's a MyLedja addition, not a Planexi token).
- Recommendation: A. It changes no Planexi token and only applies on hover grounds. Built this way in `src/design/theme.ts` (`textHelperOnHover`) until answered. #8494AB on #132F4C measures 4.42:1.
- Answer: Owner, 28 Oct 2026: A. Use the lighter helper text colour on hover rows only; no Planexi colour changes.
- Status: decided

## Q-2: Which branch do pull requests target, and where does the backend live?
- Task: F0.10
- Raised by: frontend agent
- Documents: build plan 0.5 (branches `phase-<n>/...` from `dev`, PRs into `dev`), 1.3 and 2.4 (`api:sync` reads `../MyLedja_Backend/openapi.json`)
- Options: A, keep this repo's `frontend` and `backend` branches as the two "repos" and target `frontend`. B, create `dev` and the separate `MyLedja_Frontend` and `MyLedja_Backend` repos the plan describes.
- Recommendation: A for now (this PR targets `frontend`). `api:sync` still expects a sibling `MyLedja_Backend` checkout; with A, check out the `backend` branch there as a worktree.
- Answer: Owner, 28 Oct 2026: A. Pull requests target `frontend`; `backend` is checked out as a worktree for `api:sync`. Separate repos come later.
- Status: decided

## Q-3: The auth contract isn't published yet
- Task: F0.7, F0.9
- Raised by: frontend agent
- Documents: build plan 1.1 (contract first, from the backend), TECH-SPEC 5.3 and 8 (endpoints named, shapes not)
- Options: A, the backend adopts the provisional paths and shapes in `src/api/auth.ts` and the `X-Operation-Id` header. B, the backend publishes its own and the app follows with `npm run api:sync`.
- Recommendation: B, as the plan says. The app talks only to the mock adapter until `openapi.json` exists; the screens won't change, only `src/api/auth.ts`.
- Answer: Owner, 28 Oct 2026: B. The backend publishes `openapi.json` first and the app follows with `npm run api:sync`; the mock adapter stays until then.
- Status: decided

## Q-4: "Continue with Google" has no client id the app can read
- Task: F0.9 (P01-03, P02-05)
- Raised by: frontend agent
- Documents: DESIGN.md pages 1 and 2; TECH-SPEC 2.2 (only three `EXPO_PUBLIC_` variables) and 2.3 rule 3 (an unset service is hidden, not broken); build plan T0.2 and B0.8
- Options: A, add an optional `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (and per-platform ids if T0.2 needs them). B, the app fetches the public client id from the API at start.
- Recommendation: A, optional, after prototype T0.2. The button is hidden until then.
- Answer: Owner, 28 Oct 2026: A. Add an optional `EXPO_PUBLIC_GOOGLE_CLIENT_ID` after prototype T0.2; the button stays hidden until then.
- Status: decided

## Q-5: Sign out before Settings exists
- Task: F0.6, Phase 0 journey "Sign in, sign out, recover"
- Raised by: frontend agent
- Documents: DESIGN.md 3.2 sidebar (no sign-out item); page 26 Settings (Phase 1 onwards)
- Options: A, a "Sign out" item at the foot of the sidebar and drawer until Settings ships, then move it. B, keep it there permanently.
- Recommendation: A. Built that way.
- Answer: Owner, 28 Oct 2026: A. Sign out stays at the foot of the sidebar and drawer, and moves into Settings when Settings ships.
- Status: decided

## Q-6: What the Dashboard shows in Phase 0
- Task: F0.6, F0.9 (P04-08)
- Raised by: frontend agent
- Documents: build plan Phase 0 journey lands on the Dashboard; F1.8 builds its cards in Phase 1; principle 12 (unshipped pages and actions stay out)
- Options: A, the frame with the page title and nothing else until F1.8. B, a holding message (new copy).
- Recommendation: A, built that way. The bottom bar shows only Home, and the Add buttons stay hidden until Add transaction ships. Welcome's "Add transaction" opens `/?add=expense`, which the Dashboard handles from F1.3.
- Answer: Owner, 28 Oct 2026: A. Only the Dashboard frame and title until F1.8, with no placeholder copy.
- Status: decided

## Q-7: Terms and Privacy text, and the Planexi wordmark files
- Task: F0.9 (P02-02), DESIGN.md 2.11
- Raised by: frontend agent
- Documents: DESIGN.md page 2 (reading sheet), 2.11 ("using the supplied files"), TECH-SPEC 10 (privacy notice)
- Options: the owner supplies the published Terms, Privacy notice and the wordmark SVGs.
- Recommendation: until then the reading sheet says "The full text appears here once it's published." and "by Planexi" is set in type.
- Answer: Owner, 28 Oct 2026: Keep the placeholder legal text and the typed "by Planexi"; the owner supplies the real files later.
- Status: decided

## Q-8: Bank and wallet logos in Welcome step 3
- Task: F0.9 (P04-05)
- Raised by: frontend agent
- Documents: DESIGN.md page 4 ("GTBank, Access, OPay, PalmPay, Moniepoint and more")
- Options: A, a bundled list of institutions with logo files supplied by the owner. B, logos served by the API from Cloudinary.
- Recommendation: B, so the list can grow without an app update. Not built yet; account names are typed.
- Answer: Owner, 28 Oct 2026: B. Bank and wallet logos come from the API via Cloudinary (backend builds it); typed names until then.
- Status: decided

## Q-9: GHSA-mrhx-c7xc-m3w5 in Expo's own copy of zod
- Task: F0.10 (npm audit)
- Raised by: frontend agent
- Documents: build plan 2.6 step 10
- Options: A, accept until Expo updates `@expo/cli`. B, force an override of `zod` inside `@expo/cli`.
- Recommendation: A. The affected zod 3.25.76 is used by the Expo command-line tools at build time and isn't in the app bundle; the app's own zod is 4.6.7. An override risks breaking the CLI.
- Answer: Owner, 28 Oct 2026: A. Accept the zod advisory without an override; recheck when Expo updates `@expo/cli`.
- Status: decided

## Q-10: Starter categories beyond the ones listed
- Task: F0.9 (P04-06)
- Raised by: frontend agent
- Documents: DESIGN.md page 4 step 4 ("and more")
- Options: the owner lists the full starter set.
- Recommendation: until then step 4 offers the 12 named categories in their five groups, plus "Add your own".
- Answer: Owner, 28 Oct 2026: Keep the 12 named categories in five groups, plus "Add your own".
- Status: decided

## Q-11: Passkeys in Phase 0
- Task: F0.9 (P01-07), prototype T0.1
- Raised by: frontend agent
- Documents: build plan P01-07 (Phase 3), T0.1 (needs real devices and the web domain), B3.2 (backend)
- Options: A, build the button now against a mock. B, leave it out until B3.2 and T0.1.
- Recommendation: B. A passkey button that can't sign anyone in breaks principle 12, and it needs the backend's WebAuthn endpoints and the domain association files.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: B.
- Status: answered

## Q-12: The gradient mesh on web
- Task: F0.3, DESIGN.md 2.10
- Raised by: frontend agent
- Documents: DESIGN.md 2.10 (mesh drifts over `motion-ambient` on web; still on phones)
- Options: A, draw it with `react-native-svg` on every platform and add the drift later. B, a CSS gradient on web only.
- Recommendation: A. It paints the same everywhere; CSS background images don't reach react-native-web's views.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: A. The 24 s drift is left for later; it's decoration and stays off under reduce motion anyway.
- Status: answered

## Q-13: The shared ledger-cases.json and its cross-repo hash check
- Task: F1.2 (TECH-SPEC 6.12, 6.14)
- Raised by: frontend agent
- Documents: TECH-SPEC 6.12 says both repos keep the same file and CI compares hashes.
- Options: A. The frontend's `test/fixtures/ledger-cases.json` is the first copy; the backend adopts it byte for byte. B. The backend writes it (B1.5) and the frontend copies it.
- Recommendation: A for now, so F1.2 isn't blocked. If the backend's B1.5 file differs, the frontend takes the backend's copy and updates its runner. The cross-repo hash step is added to CI once the backend file exists on `backend`. The fx-clearing account is shown as "Currency exchange" if it ever appears in a list.
- Answer:
- Status: open

## Q-14: Local store engines before the device prototypes
- Task: F1.1 (prototypes T0.3, T0.4, T0.5)
- Raised by: frontend agent
- Documents: TECH-SPEC 9; build plan 4 (prototypes)
- Options: A. Ship one key-value interface now, SQLite on phones and localStorage on web, and swap in SQLCipher and IndexedDB once T0.3 and T0.4 run on the reference phone. B. Wait for the prototypes.
- Recommendation: A. Everything above the interface (outbox, sync engine, conflicts) is tested against memory and doesn't change. Encryption at rest on phones and web storage limits are the open parts. Until the backend publishes `/sync/operations` and `/changes`, the app syncs against an in-memory stand-in, so nothing leaves the device. Phones wake the sync when the app comes to the front; a network listener for phones is added with the device test.
- Answer:
- Status: open

## Q-15: Phase 1 decisions for Add transaction, Transactions and Accounts
- Task: F1.3, F1.4, F1.5
- Raised by: frontend agent
- Documents: DESIGN.md pages 8 and 11, 2.12
- Decisions taken so as not to block:
  - Income categories: Welcome only offers expense starters, so every workspace also gets Salary, Business income, Gifts received (not counted in the budget, per 9.4 one-off income) and Other income.
  - Account group names use "and" instead of "&" ("Cash and bank"), because the copy rules forbid "&".
  - Add transaction ships Expense, Income and Transfer. "More", "Repeats" and "Receipt" arrive with their phases (A-10, A-11; receipts need the signed upload, T0.8).
  - Undo of a delete posts the original movement again as a new event, because a reversal can't itself be reversed (TECH-SPEC 6.11 check 8).
  - The phone bottom bar is a navigation landmark with links, so the + button can sit in the middle of it.
- Answer:
- Status: open

## Q-16: Phase 1 decisions for the Account page, Import and archiving
- Task: F1.5
- Raised by: frontend agent
- Documents: DESIGN.md pages 8 and 9, TECH-SPEC 6.3, build plan B1.12
- Decisions taken so as not to block:
  - "Cleared", the reconcile lock and the import batch id are bookkeeping fields stored on the event and changed in place, like notes. They never change a figure, so they aren't corrections.
  - Import reads CSV only in Phase 1. Each row gets the payee's usual category if the payee is known, otherwise the first category of the right kind; the person can change it per row in the review. There is no "Uncategorized" category, so none is invented.
  - The review counts show New and Duplicates. "Rules applied" arrives with Rules in Phase 4.
  - Duplicates: same account, same amount, dates within 3 days, and a similar description (one contains the other, or they share at least half their words).
  - Archiving a card or loan that is owed pays it off from the chosen account; an asset's balance moves to the chosen account. Both are ordinary transfers.
  - Reorder uses up and down arrows in a "Reorder" mode on every platform for now. Drag on web (P08-07) is left for a later pass.
  - Sync: an in-place change made before the record's own create has synced now counts this device's unsent writes in its base version, so it no longer conflicts with itself.
- Answer:
- Status: open
