# Screen-reader walkthrough (MYL-024)

Run on the internal beta build, once with **VoiceOver** (iPhone) and once with **TalkBack** (Android). Use swipe-to-move and double-tap only; don't look at the screen to find controls. Each journey passes when every step can be done and each control is read with a clear name, its role, and its state where it has one.

The web tree and the native contract (`a11y-walkthrough.ts`) now share the same names, roles, and states. Email/password use iOS `textContentType` so VoiceOver and the password manager can fill them; tabs, radios, and toasts set `accessibilityState` / live regions for TalkBack. Still run this list once on a phone — only a device can prove swipe order and rotor actions.

| # | Journey | Steps | Listen for |
|---|---------|-------|-----------|
| 1 | Sign in | Welcome → Sign in → Email → Password → Sign in | "Email, text field", "Password, secure text field"; the password manager offers to fill |
| 2 | Record an expense | Home → Add money (+) → Amount → a category → Save expense | "Transport, radio button, not selected", then "selected"; "Expense saved" is announced |
| 3 | Check Home | Home → balance → period → Recent | "Balance ₦…" or "Balance hidden"; "Today, radio button, selected"; rows read name, type and signed amount |
| 4 | Find a record | Transactions → Search → type 2+ letters → open a result | "Find a record, search field"; group headings; the result opens |
| 5 | Plan a budget | Plan → Budgets → Monthly amount → Save → open the budget | Budget name and "₦… spent · ₦… left"; each view's label and amount |

Also check:
- The bottom tabs announce which one is selected.
- With hide amounts on, a bill reminder on the lock screen says "Bill due tomorrow" and no amount (Android shows "Contents hidden").
- Large text (200%) doesn't cut off amounts on Home or in the expense sheet.

Record the device, OS version, reader, and pass or fail per journey in `docs/beta-artifacts.md`.
