import type { TxFilters } from './filters';
import { filtersFromParams, filtersToParams } from './filters';

export type SavedView = { id: string; name: string; filters: TxFilters };

const KEY = 'myledja:tx-saved-views';

function readRaw(): { id: string; name: string; params: Record<string, string> }[] {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    const raw = globalThis.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { id: string; name: string; params: Record<string, string> }[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(rows: { id: string; name: string; params: Record<string, string> }[]) {
  if (typeof globalThis.localStorage === 'undefined') return;
  globalThis.localStorage.setItem(KEY, JSON.stringify(rows));
}

export function listSavedViews(): SavedView[] {
  return readRaw().map((r) => ({ id: r.id, name: r.name, filters: filtersFromParams(r.params) }));
}

export function saveView(name: string, filters: TxFilters): SavedView {
  const id = `view_${Date.now().toString(36)}`;
  const row = { id, name: name.trim(), params: filtersToParams(filters) };
  writeRaw([...readRaw(), row]);
  return { id, name: row.name, filters };
}

export function renameSavedView(id: string, name: string): void {
  writeRaw(readRaw().map((r) => (r.id === id ? { ...r, name: name.trim() } : r)));
}

export function deleteSavedView(id: string): void {
  writeRaw(readRaw().filter((r) => r.id !== id));
}

export function getSavedView(id: string): SavedView | null {
  return listSavedViews().find((v) => v.id === id) ?? null;
}
