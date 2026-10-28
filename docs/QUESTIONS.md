# Questions

Format and rules: build plan section 14. Each open question stops only the task it names.

## Q-1: Dark theme helper text fails contrast on hover rows
- Task: F0.3
- Raised by: frontend agent
- Documents: DESIGN.md 2.1 (Dark column: helper text `hairline-input` #8494AB, hover row #132F4C); build plan F0.3 (every text and background pair passes WCAG AA)
- Options: A, use `primary-bg-subdued-hover` (#DCE3EE) for helper text on dark hover rows and table headers only (10.9:1). B, lighten the dark hover colour (it's a MyLedja addition, not a Planexi token).
- Recommendation: A. It changes no Planexi token and only applies on hover grounds. Built this way in `src/design/theme.ts` (`textHelperOnHover`) until answered. #8494AB on #132F4C measures 4.42:1.
- Answer: Owner, 28 Oct 2026: A stands.
- Status: answered

## Q-2: Which branch do pull requests target, and where does the backend live?
- Task: F0.10
- Raised by: frontend agent
- Documents: build plan 0.5 (branches `phase-<n>/...` from `dev`, PRs into `dev`), 1.3 and 2.4 (`api:sync` reads `../MyLedja_Backend/openapi.json`)
- Options: A, keep this repo's `frontend` and `backend` branches as the two "repos" and target `frontend`. B, create `dev` and the separate `MyLedja_Frontend` and `MyLedja_Backend` repos the plan describes.
- Recommendation: A for now (this PR targets `frontend`). `api:sync` still expects a sibling `MyLedja_Backend` checkout; with A, check out the `backend` branch there as a worktree.
- Answer: Owner, 28 Oct 2026: A. Keep the `frontend` and `backend` branches; no `dev`. Pull requests target `frontend`.
- Status: answered

## Q-3: The auth contract isn't published yet
- Task: F0.7, F0.9
- Raised by: frontend agent
- Documents: build plan 1.1 (contract first, from the backend), TECH-SPEC 5.3 and 8 (endpoints named, shapes not)
- Options: A, the backend adopts the provisional paths and shapes in `src/api/auth.ts` and the `X-Operation-Id` header. B, the backend publishes its own and the app follows with `npm run api:sync`.
- Recommendation: B, as the plan says. The app talks only to the mock adapter until `openapi.json` exists; the screens won't change, only `src/api/auth.ts`.
- Answer: Owner, 28 Oct 2026: B. The backend worker publishes the contract on `backend`; the app switches its auth shapes when it lands.
- Status: answered

## Q-4: "Continue with Google" has no client id the app can read
- Task: F0.9 (P01-03, P02-05)
- Raised by: frontend agent
- Documents: DESIGN.md pages 1 and 2; TECH-SPEC 2.2 (only three `EXPO_PUBLIC_` variables) and 2.3 rule 3 (an unset service is hidden, not broken); build plan T0.2 and B0.8
- Options: A, add an optional `EXPO_PUBLIC_GOOGLE_CLIENT_ID` (and per-platform ids if T0.2 needs them). B, the app fetches the public client id from the API at start.
- Recommendation: A, optional, after prototype T0.2. The button is hidden until then.
- Answer: Owner, 28 Oct 2026: keep Google sign-in hidden.
- Status: answered

## Q-5: Sign out before Settings exists
- Task: F0.6, Phase 0 journey "Sign in, sign out, recover"
- Raised by: frontend agent
- Documents: DESIGN.md 3.2 sidebar (no sign-out item); page 26 Settings (Phase 1 onwards)
- Options: A, a "Sign out" item at the foot of the sidebar and drawer until Settings ships, then move it. B, keep it there permanently.
- Recommendation: A. Built that way.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: A.
- Status: answered

## Q-6: What the Dashboard shows in Phase 0
- Task: F0.6, F0.9 (P04-08)
- Raised by: frontend agent
- Documents: build plan Phase 0 journey lands on the Dashboard; F1.8 builds its cards in Phase 1; principle 12 (unshipped pages and actions stay out)
- Options: A, the frame with the page title and nothing else until F1.8. B, a holding message (new copy).
- Recommendation: A, built that way. The bottom bar shows only Home, and the Add buttons stay hidden until Add transaction ships. Welcome's "Add transaction" opens `/?add=expense`, which the Dashboard handles from F1.3.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: A.
- Status: answered

## Q-7: Terms and Privacy text, and the Planexi wordmark files
- Task: F0.9 (P02-02), DESIGN.md 2.11
- Raised by: frontend agent
- Documents: DESIGN.md page 2 (reading sheet), 2.11 ("using the supplied files"), TECH-SPEC 10 (privacy notice)
- Options: the owner supplies the published Terms, Privacy notice and the wordmark SVGs.
- Recommendation: until then the reading sheet says "The full text appears here once it's published." and "by Planexi" is set in type.
- Answer: Owner, 28 Oct 2026: text and logos come later; use clean placeholders. The reading sheet keeps its one-line placeholder, "by Planexi" stays in type, and the logomark loader uses a navy spinner until the files arrive.
- Status: answered

## Q-8: Bank and wallet logos in Welcome step 3
- Task: F0.9 (P04-05)
- Raised by: frontend agent
- Documents: DESIGN.md page 4 ("GTBank, Access, OPay, PalmPay, Moniepoint and more")
- Options: A, a bundled list of institutions with logo files supplied by the owner. B, logos served by the API from Cloudinary.
- Recommendation: B, so the list can grow without an app update. Not built yet; account names are typed.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: B, when the backend can serve them. Until then names are typed and tiles show initials.
- Status: answered

## Q-9: GHSA-mrhx-c7xc-m3w5 in Expo's own copy of zod
- Task: F0.10 (npm audit)
- Raised by: frontend agent
- Documents: build plan 2.6 step 10
- Options: A, accept until Expo updates `@expo/cli`. B, force an override of `zod` inside `@expo/cli`.
- Recommendation: A. The affected zod 3.25.76 is used by the Expo command-line tools at build time and isn't in the app bundle; the app's own zod is 4.6.7. An override risks breaking the CLI.
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: A. Revisit when Expo updates `@expo/cli`.
- Status: answered

## Q-10: Starter categories beyond the ones listed
- Task: F0.9 (P04-06)
- Raised by: frontend agent
- Documents: DESIGN.md page 4 step 4 ("and more")
- Options: the owner lists the full starter set.
- Recommendation: until then step 4 offers the 12 named categories in their five groups, plus "Add your own".
- Answer: Agent decision under the owner's delegation, 28 Oct 2026: the 12 named categories ship; more can be added in Settings from Phase 1.
- Status: answered

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
