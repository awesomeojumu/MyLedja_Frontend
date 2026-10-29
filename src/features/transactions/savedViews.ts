import type { TxFilters } from './filters';
import { filtersFromParams, filtersToParams } from './filters';

export type SavedView = { id: string; name: string; filters: TxFilters };

const LEGACY_KEY = 'myledja:tx-saved-views';

type RawRow = { id: string; name: string; params: Record<string, string> };

function storageKey(workspaceId?: string): string {
  return workspaceId ? `myledja:tx-saved-views:${workspaceId}` : LEGACY_KEY;
}

function readRaw(workspaceId?: string): RawRow[] {
  if (typeof globalThis.localStorage === 'undefined') return [];
  try {
    const scoped = workspaceId ? globalThis.localStorage.getItem(storageKey(workspaceId)) : null;
    const legacy = globalThis.localStorage.getItem(LEGACY_KEY);
    const raw = scoped ?? (!workspaceId ? legacy : null) ?? (workspaceId && !scoped ? legacy : null);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RawRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRaw(rows: RawRow[], workspaceId?: string) {
  if (typeof globalThis.localStorage === 'undefined') return;
  const json = JSON.stringify(rows);
  globalThis.localStorage.setItem(storageKey(workspaceId), json);
  // Keep legacy key in sync so older readers and Sync can pick up later.
  if (!workspaceId || workspaceId) {
    globalThis.localStorage.setItem(LEGACY_KEY, json);
  }
}

export function listSavedViews(workspaceId?: string): SavedView[] {
  return readRaw(workspaceId).map((r) => ({ id: r.id, name: r.name, filters: filtersFromParams(r.params) }));
}

export function saveView(name: string, filters: TxFilters, workspaceId?: string): SavedView {
  const id = `view_${Date.now().toString(36)}`;
  const row = { id, name: name.trim(), params: filtersToParams(filters) };
  writeRaw([...readRaw(workspaceId), row], workspaceId);
  return { id, name: row.name, filters };
}

export function renameSavedView(id: string, name: string, workspaceId?: string): void {
  writeRaw(
    readRaw(workspaceId).map((r) => (r.id === id ? { ...r, name: name.trim() } : r)),
    workspaceId,
  );
}

export function deleteSavedView(id: string, workspaceId?: string): void {
  writeRaw(
    readRaw(workspaceId).filter((r) => r.id !== id),
    workspaceId,
  );
}

export function getSavedView(id: string, workspaceId?: string): SavedView | null {
  return listSavedViews(workspaceId).find((v) => v.id === id) ?? null;
}

/** JSON blob for Sync / backup handoff (TB13-2). */
export function exportSavedViewsJson(workspaceId?: string): string {
  return JSON.stringify(readRaw(workspaceId));
}

export function importSavedViewsJson(json: string, workspaceId?: string): SavedView[] {
  const parsed = JSON.parse(json) as RawRow[];
  if (!Array.isArray(parsed)) throw new Error('invalid');
  writeRaw(parsed, workspaceId);
  return listSavedViews(workspaceId);
}

/** Cross-tab refresh: listen for storage writes to the workspace key. */
export function subscribeSavedViews(workspaceId: string | undefined, onChange: () => void): () => void {
  if (typeof globalThis.addEventListener !== 'function') return () => undefined;
  const key = storageKey(workspaceId);
  const handler = (e: StorageEvent) => {
    if (e.key === key || e.key === LEGACY_KEY) onChange();
  };
  globalThis.addEventListener('storage', handler);
  return () => globalThis.removeEventListener('storage', handler);
}
