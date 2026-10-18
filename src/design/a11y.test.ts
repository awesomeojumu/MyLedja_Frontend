import { a11yState, textContentTypeFor } from "@/design/a11y";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const radio = a11yState({ checked: true }) as Record<string, unknown>;
assert(radio["aria-checked"] === true, "checked reaches the web as aria-checked");
assert((radio.accessibilityState as { checked?: boolean }).checked === true, "phones keep accessibilityState");

const tab = a11yState({ selected: false, disabled: true }) as Record<string, unknown>;
assert(tab["aria-selected"] === false && tab["aria-disabled"] === true, "selected and disabled both announced");
assert(!("aria-checked" in tab), "no aria-checked when checked was not given");

assert(textContentTypeFor("email") === "emailAddress", "email field is emailAddress for VoiceOver");
assert(textContentTypeFor("current-password") === "password", "password field is password for the manager");

console.log("a11y: selected and checked states reach web screen readers");
