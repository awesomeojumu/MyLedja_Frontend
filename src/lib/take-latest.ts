export function createLatestGate() {
  let generation = 0;
  return {
    begin() {
      const id = ++generation;
      return {
        apply<T>(value: T, write: (next: T) => void): boolean {
          if (id !== generation) return false;
          write(value);
          return true;
        },
        isCurrent() {
          return id === generation;
        },
      };
    },
  };
}
