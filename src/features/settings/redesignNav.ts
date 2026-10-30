import type { SettingsTabId } from './shipped';

/** Figma Phone / Settings hub groups (6:2461) — all 13 sections. */
export const REDESIGN_SETTINGS_GROUPS: {
  id: string;
  titleKey: string;
  tabs: SettingsTabId[];
}[] = [
  {
    id: 'everyday',
    titleKey: 'settings.redesign.groupEveryday',
    tabs: ['general', 'budget', 'categories', 'notifications'],
  },
  {
    id: 'safety',
    titleKey: 'settings.redesign.groupSafety',
    tabs: ['security', 'devices', 'banks'],
  },
  {
    id: 'data',
    titleKey: 'settings.redesign.groupData',
    tabs: ['importExport', 'currencies', 'workspace', 'ai'],
  },
  {
    id: 'more',
    titleKey: 'settings.redesign.groupMore',
    tabs: ['advanced', 'help'],
  },
];

/** Figma short titles (not the longer legacy tab labels). */
export const REDESIGN_SETTINGS_TITLE: Record<SettingsTabId, string> = {
  general: 'settings.redesign.tab.general',
  budget: 'settings.redesign.tab.budget',
  categories: 'settings.redesign.tab.categories',
  notifications: 'settings.redesign.tab.notifications',
  security: 'settings.redesign.tab.security',
  devices: 'settings.redesign.tab.devices',
  banks: 'settings.redesign.tab.banks',
  importExport: 'settings.redesign.tab.importExport',
  currencies: 'settings.redesign.tab.currencies',
  workspace: 'settings.redesign.tab.workspace',
  ai: 'settings.redesign.tab.ai',
  advanced: 'settings.redesign.tab.advanced',
  help: 'settings.redesign.tab.help',
};

export function settingsPathSegment(id: SettingsTabId): string {
  if (id === 'importExport') return 'data';
  if (id === 'devices') return 'sync';
  return id;
}

export function settingsTabFromPath(raw: string | string[] | undefined): SettingsTabId | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v) return null;
  const alias: Record<string, SettingsTabId> = { sync: 'devices', data: 'importExport' };
  const id = (alias[v] ?? v) as SettingsTabId;
  return id in REDESIGN_SETTINGS_TITLE ? id : null;
}
