/** The one local-store interface (prototype T0.4). Values are JSON strings. */
export interface KeyValue {
  get(key: string): Promise<string | null>;
  set(entries: [string, string][]): Promise<void>;
  remove(keys: string[]): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

export class MemoryKeyValue implements KeyValue {
  readonly data = new Map<string, string>();

  async get(key: string) {
    return this.data.get(key) ?? null;
  }

  async set(entries: [string, string][]) {
    for (const [k, v] of entries) this.data.set(k, v);
  }

  async remove(keys: string[]) {
    for (const k of keys) this.data.delete(k);
  }

  async keys(prefix: string) {
    return [...this.data.keys()].filter((k) => k.startsWith(prefix));
  }
}
