/**
 * Settings tabs by phase (addendum TB-11).
 * HANDOFF: Phase 1–5 shipped; Advanced (after Release 3) stays hidden.
 */
export const SHIPPED_PHASE = 5;

export type SettingsTabId =
  | 'general'
  | 'ai'
  | 'budget'
  | 'categories'
  | 'currencies'
  | 'banks'
  | 'importExport'
  | 'workspace'
  | 'security'
  | 'notifications'
  | 'devices'
  | 'advanced'
  | 'help';

/** Phase number; 99 = after Release 3. */
export const SETTINGS_TAB_PHASE: Record<SettingsTabId, number> = {
  general: 1,
  budget: 1,
  categories: 1,
  importExport: 1,
  help: 1,
  notifications: 2,
  security: 3,
  devices: 3,
  workspace: 3,
  ai: 4,
  banks: 4,
  currencies: 5,
  advanced: 99,
};

export function settingsTabShipped(tab: SettingsTabId, phase = SHIPPED_PHASE): boolean {
  return SETTINGS_TAB_PHASE[tab] <= phase;
}

export function shippedSettingsTabs(phase = SHIPPED_PHASE): SettingsTabId[] {
  return (Object.keys(SETTINGS_TAB_PHASE) as SettingsTabId[]).filter((id) => settingsTabShipped(id, phase));
}
