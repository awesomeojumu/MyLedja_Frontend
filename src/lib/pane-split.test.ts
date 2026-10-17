import { paneSplits, sideColumnWidth } from "@/lib/pane-split";

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
}

assertEqual(paneSplits("compact", true, true), false, "phone never splits");
assertEqual(paneSplits("medium", true, true), false, "portrait tablet stacks");
assertEqual(paneSplits("medium", false, true), true, "landscape tablet splits list-plus-detail screens");
assertEqual(paneSplits("medium", false, false), false, "other screens stay single column on a tablet");
assertEqual(paneSplits("expanded", false, false), true, "expanded splits every pane");
assertEqual(paneSplits("large", false, false), true, "web splits every pane");
assertEqual(sideColumnWidth("medium"), 300, "tablet side column");
assertEqual(sideColumnWidth("large"), 360, "web side column");

console.log("pane-split: phone stacks, landscape tablet splits list-plus-detail, web splits");
