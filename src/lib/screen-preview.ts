export type ScreenPreview = "ready" | "loading" | "empty" | "error" | "offline";

export const SCREEN_PREVIEW_OPTIONS: { value: ScreenPreview; label: string }[] = [
  { value: "ready", label: "Ready" },
  { value: "loading", label: "Loading" },
  { value: "empty", label: "Empty" },
  { value: "error", label: "Error" },
  { value: "offline", label: "Offline" },
];
