import { liveKind, showEmptyCopy, showZeroMoney } from "@/lib/live-states";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(liveKind({ known: false, offline: false, error: null, rows: 0 }) === "loading", "unknown is loading");
assert(liveKind({ known: true, offline: true, error: null, rows: 2 }) === "offline-cached", "cache plus offline");
assert(liveKind({ known: false, offline: true, error: null, rows: 0 }) === "offline-empty", "offline with nothing saved");
assert(liveKind({ known: true, offline: false, error: null, rows: 0 }) === "empty", "real empty only when known");
assert(!showEmptyCopy("loading") && !showEmptyCopy("offline-empty"), "loading is not empty copy");
assert(showEmptyCopy("empty"), "known empty may say so");
assert(!showZeroMoney("loading"), "do not show ₦0 while loading");
assert(showZeroMoney("ready"), "a loaded figure may be zero");

console.log("live-states: loading, cached offline, real empty");
