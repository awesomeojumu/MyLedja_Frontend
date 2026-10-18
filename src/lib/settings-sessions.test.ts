import { sessionLine, showSessionCount } from "@/lib/settings-sessions";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(sessionLine({ id: "s1", deviceLabel: "This browser", current: true }) === "This browser · now", "named row");
assert(showSessionCount([{ id: "s1", deviceLabel: "This browser" }]) === false, "drop the 1 sessions copy");

console.log("settings-sessions: named device label");
