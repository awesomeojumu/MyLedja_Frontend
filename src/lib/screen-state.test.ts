import { SCREEN_PREVIEW_OPTIONS, type ScreenPreview } from "./screen-preview";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const values = SCREEN_PREVIEW_OPTIONS.map((option) => option.value);
const needed: ScreenPreview[] = ["ready", "loading", "empty", "error", "offline"];

assert(needed.every((state) => values.includes(state)), "All four design states plus ready are listed");
assert(SCREEN_PREVIEW_OPTIONS.length === 5, "Ready plus four AC states");

console.log("screen-state: ready, loading, empty, error, offline");
