import type { Theme } from "@/design/theme";

export type NavMode = "bottom" | "rail" | "side";
export type WidthClass = Theme["widthClass"];

export function isPortrait(width: number, height: number): boolean {
  return height > width;
}

/** Side-by-side chrome (auth brand pane). False on phones and on any portrait rotation. */
export function splitLayout(widthClass: WidthClass, portrait = false): boolean {
  return !portrait && widthClass !== "compact";
}

export function navMode(widthClass: WidthClass, portrait = false): NavMode {
  if (portrait) return "bottom";
  if (widthClass === "large") return "side";
  if (widthClass === "medium" || widthClass === "expanded") return "rail";
  return "bottom";
}

/** Phone bar: Home, Transactions, the + button, Plan, Accounts, More (MYL-007 navigation shell). */
export function phoneBarDestinations(): readonly ["home", "transactions", "plan", "accounts", "more"] {
  return ["home", "transactions", "plan", "accounts", "more"];
}

export function twoColumn(widthClass: WidthClass, portrait = false): boolean {
  if (portrait) return false;
  return widthClass === "expanded" || widthClass === "large";
}
