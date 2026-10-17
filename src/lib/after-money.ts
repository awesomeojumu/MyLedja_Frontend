import { clearSnapshots } from "@/features/dashboard/services/range-cache";

let writes = 0;
const listeners = new Set<(n: number) => void>();

export function moneyWriteCount(): number {
  return writes;
}

export function onMoneyWrite(listener: (n: number) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function afterMoneyWrite(): void {
  clearSnapshots();
  writes += 1;
  for (const listener of listeners) listener(writes);
}
