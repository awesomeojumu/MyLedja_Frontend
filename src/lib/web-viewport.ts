/** True for iPhone and iPad browsers, including iPadOS, which reports itself as a Mac with touch. */
export function isIosBrowser(userAgent: string, maxTouchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/**
 * iOS Safari zooms the page in when you tap a field whose text is under 16px, and stays zoomed. Adding
 * maximum-scale=1 stops that; iOS still allows pinch zoom, so nobody loses zoom for reading. Android browsers
 * don't auto-zoom on focus, and there maximum-scale would block pinch zoom, so they are left alone.
 */
export function stopIosInputZoom(): void {
  if (typeof document === "undefined" || typeof navigator === "undefined") return;
  if (!isIosBrowser(navigator.userAgent, navigator.maxTouchPoints ?? 0)) return;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  const parts = (meta.content || "width=device-width, initial-scale=1")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("maximum-scale"));
  meta.content = [...parts, "maximum-scale=1"].join(", ");
}
