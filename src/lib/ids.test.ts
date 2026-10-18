import { newId } from "./ids";

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const id = newId();
assert(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id), `bad uuid ${id}`);
assert(newId() !== id, "ids must differ");

console.log("ids: uuidv7 without a crypto global");
