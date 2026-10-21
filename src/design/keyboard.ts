/* Where the on-screen keyboard is, so forms can move out of its way. Browser: read from visualViewport. Apps: Keyboard events. */
import { useEffect, useState } from "react";
import { Animated, Easing, Keyboard, Platform } from "react-native";
import { KEYBOARD_CLOSED, webKeyboardFrame, type KeyboardFrame } from "@/design/keyboard-frame";

export { KEYBOARD_CLOSED, webKeyboardFrame, type KeyboardFrame } from "@/design/keyboard-frame";

const NOT_TYPING = new Set(["button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"]);

function textFieldFocused(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  if (el.tagName === "TEXTAREA") return true;
  if (el.tagName === "INPUT") return !NOT_TYPING.has((el as HTMLInputElement).type);
  return el.isContentEditable;
}

function sameFrame(a: KeyboardFrame, b: KeyboardFrame): boolean {
  return a.open === b.open && a.inset === b.inset && a.top === b.top;
}

/** The keyboard's frame, updated as it opens, resizes and closes. */
export function useKeyboard(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>(KEYBOARD_CLOSED);
  useEffect(() => {
    if (Platform.OS !== "web") {
      const iosApp = Platform.OS === "ios";
      const show = Keyboard.addListener(iosApp ? "keyboardWillShow" : "keyboardDidShow", (e) =>
        setFrame({ open: true, inset: Math.round(e.endCoordinates.height), top: 0 }),
      );
      const hide = Keyboard.addListener(iosApp ? "keyboardWillHide" : "keyboardDidHide", () => setFrame(KEYBOARD_CLOSED));
      return () => {
        show.remove();
        hide.remove();
      };
    }
    if (typeof window === "undefined" || typeof document === "undefined") return;
    const vv = window.visualViewport;
    const touch = (navigator.maxTouchPoints ?? 0) > 0;
    let raf = 0;
    let lastInset = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const next = webKeyboardFrame(window.innerHeight, vv ? vv.height : window.innerHeight, vv ? vv.offsetTop : 0, textFieldFocused(), touch);
        // Once the keyboard has taken its space, bring the field being typed in back into view.
        if (next.open && next.inset + next.top > lastInset) {
          const el = document.activeElement as HTMLElement | null;
          setTimeout(() => el?.scrollIntoView?.({ block: "center", behavior: "smooth" }), 60);
        }
        lastInset = next.inset + next.top;
        setFrame((prev) => (sameFrame(prev, next) ? prev : next));
      });
    };
    // Focus moves between fields without the keyboard closing; wait a tick before reading focusout.
    const blur = () => setTimeout(measure, 0);
    vv?.addEventListener("resize", measure);
    vv?.addEventListener("scroll", measure);
    window.addEventListener("resize", measure);
    document.addEventListener("focusin", measure);
    document.addEventListener("focusout", blur);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", measure);
      vv?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      document.removeEventListener("focusin", measure);
      document.removeEventListener("focusout", blur);
    };
  }, []);
  return frame;
}

/** A number that glides to `target` (for padding that makes room for the keyboard). Jumps under reduce motion. */
export function useGlide(target: number, reduceMotion: boolean): Animated.Value {
  const [v] = useState(() => new Animated.Value(target));
  useEffect(() => {
    if (reduceMotion) {
      v.setValue(target);
      return;
    }
    const anim = Animated.timing(v, { toValue: target, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false });
    anim.start();
    return () => anim.stop();
  }, [target, reduceMotion, v]);
  return v;
}
