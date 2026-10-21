import { KEYBOARD_CLOSED, webKeyboardFrame } from "@/design/keyboard-frame";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}
const same = (a: object, b: object) => JSON.stringify(a) === JSON.stringify(b);

// iPhone Safari: page stays 800 tall, visible area drops to 470 and scrolls 30 down; 300 is hidden.
assert(same(webKeyboardFrame(800, 470, 30, true, true), { open: true, inset: 300, top: 30 }), "iPhone keyboard lifts by the hidden strip");
// Android Chrome with resizes-content: the page itself shrinks, nothing extra to lift.
assert(same(webKeyboardFrame(500, 500, 0, true, true), { open: true, inset: 0, top: 0 }), "Android already made room");
// The URL bar growing a little is not a keyboard.
assert(webKeyboardFrame(800, 760, 0, true, true).inset === 0, "small gaps ignored");
assert(same(webKeyboardFrame(800, 470, 30, false, true), KEYBOARD_CLOSED), "no field focused, no keyboard");
assert(same(webKeyboardFrame(800, 470, 0, true, false), KEYBOARD_CLOSED), "desktop typing has no on-screen keyboard");
console.log("keyboard: lifts only what the keyboard hides");
