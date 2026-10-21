import { isIosBrowser } from "@/lib/web-viewport";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(isIosBrowser("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5), "iPhone");
assert(isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5), "iPadOS reports as a Mac with touch");
assert(!isIosBrowser("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0), "a real Mac keeps zoom");
assert(!isIosBrowser("Mozilla/5.0 (Linux; Android 15; Pixel 9)", 5), "Android keeps pinch zoom");
console.log("web-viewport: iOS input zoom only");
