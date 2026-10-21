/** True for iPhone and iPad browsers, including iPadOS, which reports itself as a Mac with touch. */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * The viewport settings the app wants, kept on top of whatever the page started with.
 * - interactive-widget=resizes-content: Android Chrome shrinks the page when the keyboard opens, so forms and their
 *   buttons move up by themselves. Browsers that don't know it ignore it.
 * - maximum-scale=1, iOS only: iOS Safari zooms the page in when you tap a field whose text is under 16px, and stays
 *   zoomed. This stops that; iOS still allows pinch zoom. Elsewhere it would block pinch zoom, so it's left off.
 */
export function viewportContent(current: string, ios: boolean): string {
  const parts = (current || "width=device-width, initial-scale=1")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("maximum-scale") && !p.startsWith("interactive-widget"));
  return [...parts, "interactive-widget=resizes-content", ...(ios ? ["maximum-scale=1"] : [])].join(", ");
}

/** Applies viewportContent to the page's viewport tag. Does nothing in the iPhone and Android apps. */
export function configureViewport(): void {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.content = viewportContent(meta.content, isIosBrowser(navigator.userAgent, navigator.maxTouchPoints ?? 0));
}
