import type { AccessibilityState, TextInputProps } from "react-native";

/** iOS VoiceOver + the password manager read `textContentType`. Android/web already have `autoComplete`. */
export function textContentTypeFor(
  autoComplete?: TextInputProps["autoComplete"],
): TextInputProps["textContentType"] | undefined {
  if (autoComplete === "email") return "emailAddress";
  if (autoComplete === "current-password") return "password";
  if (autoComplete === "new-password") return "newPassword";
  if (autoComplete === "name") return "name";
  if (autoComplete === "one-time-code") return "oneTimeCode";
  if (autoComplete === "username") return "username";
  return undefined;
}

/**
 * Selected / checked / disabled / busy, announced on every platform. Phones read `accessibilityState`; the web build
 * (react-native-web 0.21) only emits the `aria-*` props, so a screen reader there would never hear "selected" or
 * "checked" without them. Spread it: `<Pressable {...a11yState({ selected: on })} />`.
 */
export function a11yState(state: AccessibilityState) {
  const checked = state.checked;
  return {
    accessibilityState: state,
    ...(checked !== undefined ? { "aria-checked": checked } : null),
    ...(state.selected !== undefined ? { "aria-selected": !!state.selected } : null),
    ...(state.disabled !== undefined ? { "aria-disabled": !!state.disabled } : null),
    ...(state.busy !== undefined ? { "aria-busy": !!state.busy } : null),
    ...(state.expanded !== undefined ? { "aria-expanded": !!state.expanded } : null),
  } as const;
}
