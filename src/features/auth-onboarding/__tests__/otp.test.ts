import { appendDigit, deleteDigit, isComplete, OTP_LENGTH } from "../otp";

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

assertEqual(OTP_LENGTH, 6);
assertEqual(appendDigit("", "4"), "4");
assertEqual(appendDigit("482193", "0"), "482193");
assertEqual(appendDigit("12", "a"), "12");
assertEqual(deleteDigit("48"), "4");
assertEqual(deleteDigit(""), "");
assert(isComplete("482193"), "six digits complete an OTP");
assert(!isComplete("4821"), "short OTP is incomplete");

console.log("otp: append, delete, and complete work");
