import { createLatestGate } from "@/lib/take-latest";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const gate = createLatestGate();
const first = gate.begin();
const second = gate.begin();
let shown = "0";
first.apply("0", (next) => {
  shown = next;
});
second.apply("4500.50", (next) => {
  shown = next;
});
assert(shown === "4500.50", "later load wins when it finishes first");
first.apply("0", (next) => {
  shown = next;
});
assert(shown === "4500.50", "stale spent 0 is ignored");

console.log("take-latest: stale dashboard response is dropped");
