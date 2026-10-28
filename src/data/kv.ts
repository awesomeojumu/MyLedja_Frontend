import { MemoryKeyValue, type KeyValue } from './kv.shared';

export { MemoryKeyValue, type KeyValue } from './kv.shared';

/** Web store on localStorage; falls back to memory where storage is blocked. */
export function openKeyValue(name = 'myledja'): KeyValue {
  const storage = typeof window !== 'undefined' ? window.localStorage : undefined;
  if (!storage) return new MemoryKeyValue();
  const prefixed = (k: string) => `${name}:${k}`;
  return {
    async get(key) {
      return storage.getItem(prefixed(key));
    },
    async set(entries) {
      for (const [k, v] of entries) storage.setItem(prefixed(k), v);
    },
    async remove(keys) {
      for (const k of keys) storage.removeItem(prefixed(k));
    },
    async keys(prefix) {
      const out: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k?.startsWith(prefixed(prefix))) out.push(k.slice(name.length + 1));
      }
      return out;
    },
  };
}
