import { isIosBrowser, viewportContent } from "@/lib/web-viewport";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isIosBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5), "iPhone");
assert(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "iPadOS reports as a Mac with touch");
assert(!isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "a real Mac keeps zoom");
assert(!isIosBrowser("Mozilla/5.0 (Linux; Android 15; Pixel 9)", 5), "Android keeps pinch zoom");
console.log("web-viewport: iOS input zoom only");

const start = "width=device-width, initial-scale=1, shrink-to-fit=no";
assert(viewportContent(start, false) === `${start}, interactive-widget=resizes-content`, "Android and desktop: resize for the keyboard, keep pinch zoom");
assert(viewportContent(start, true) === `${start}, interactive-widget=resizes-content, maximum-scale=1`, "iOS: also stop focus zoom");
assert(viewportContent(viewportContent(start, true), true) === viewportContent(start, true), "running twice changes nothing");
console.log("web-viewport: keyboard resize everywhere");
