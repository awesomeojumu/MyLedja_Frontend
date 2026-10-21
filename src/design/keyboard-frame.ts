/* The keyboard frame maths, free of React Native so it can be tested on its own. */
export interface KeyboardFrame {
  /** A keyboard is up (a text field has focus on a touch screen, or the app keyboard is showing). */
  open: boolean;
  /** How much of the bottom of the page the keyboard hides, in px. 0 when the browser already shrank the page. */
  inset: number;
  /** How far iOS Safari has pushed the page up to show the field, in px. */
  top: number;
}

export const KEYBOARD_CLOSED: KeyboardFrame = { open: false, inset: 0, top: 0 };

/**
 * The browser frame from window and visualViewport sizes. iOS Safari doesn't shrink the page for the keyboard: the
 * visible area gets shorter and may scroll down by offsetTop, so the hidden strip is what's left below it. Android
 * Chrome with interactive-widget=resizes-content shrinks the page itself, so the strip is 0 there. Small gaps (the
 * URL bar growing) are ignored.
 */
export function webKeyboardFrame(innerHeight: number, visibleHeight: number, offsetTop: number, focused: boolean, touch: boolean): KeyboardFrame {
  if (!focused || !touch) return KEYBOARD_CLOSED;
  const hidden = Math.round(innerHeight - visibleHeight - offsetTop);
  return { open: true, inset: hidden > 60 ? hidden : 0, top: Math.max(0, Math.round(offsetTop)) };
}
