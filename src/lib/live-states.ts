export type LiveKind = "loading" | "offline-cached" | "offline-empty" | "empty" | "error" | "ready";

export function liveKind(input: {
  known: boolean;
  offline: boolean;
  error: string | null;
  rows: number;
}): LiveKind {
  if (input.offline && input.rows > 0) return "offline-cached";
  if (input.offline && !input.known) return "offline-empty";
  if (input.error && !input.known) return "error";
  if (!input.known) return "loading";
  if (input.rows === 0) return "empty";
  if (input.offline) return "offline-cached";
  if (input.error) return "error";
  return "ready";
}

export function showEmptyCopy(kind: LiveKind): boolean {
  return kind === "empty";
}

export function showZeroMoney(kind: LiveKind): boolean {
  return kind === "ready" || kind === "offline-cached" || kind === "empty";
}
