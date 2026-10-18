import { namedFontFamily, WEB_SPACE_CSS } from "@/design/font-stack";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assert(namedFontFamily(undefined, true) === undefined, "empty family stays empty");
assert(namedFontFamily("Inter_400Regular", false) === "Inter_400Regular", "native keeps the loaded face");
assert(
  namedFontFamily("Inter_400Regular", true) === "ui-sans-serif, system-ui, Segoe UI, sans-serif",
  "web uses system UI so spaces render",
);
assert(WEB_SPACE_CSS.includes("pre-wrap"), "web CSS keeps word spaces");

console.log("font-stack: web fallbacks keep spaces");
