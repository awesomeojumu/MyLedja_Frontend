import { DEFAULT_HEALTH_SETTINGS, type HealthSettings } from "@/features/financial-health/services/health-model";
import { readCache, writeCache } from "@/lib/offline-cache";

const listeners = new Set<() => void>();

export function loadHealthSettings(key: string): HealthSettings {
  return readCache<HealthSettings>(key) ?? DEFAULT_HEALTH_SETTINGS;
}

export function saveHealthSettings(key: string, next: HealthSettings): HealthSettings {
  writeCache(key, next);
  for (const notify of listeners) notify();
  return next;
}

export function onHealthSettingsChange(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}
