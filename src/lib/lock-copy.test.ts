import { lockScreenCopy, lockScreenSafe } from "@/lib/lock-copy";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(lockScreenSafe("DSTV is due", true), "plain title is safe");
assert(!lockScreenSafe("DSTV ₦24,500 is due", true), "money in lock screen fails");
assert(lockScreenCopy("DSTV ₦24,500 is due", true).includes("DSTV"), "strips the amount");
assert(!/₦|\d{2,}/.test(lockScreenCopy("DSTV ₦24,500 is due", true)), "no leftover money");
console.log("lock-copy: Q3 hide amounts");
