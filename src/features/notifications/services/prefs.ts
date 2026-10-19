export type ReminderPrefs = {
  bills: boolean;
  budget: boolean;
  summary: boolean;
};

export const DEFAULT_REMINDERS: ReminderPrefs = {
  bills: true,
  budget: true,
  summary: false,
};

/** Missing toggles use the product defaults. A bad payload never turns security into a switch. */
export function readReminders(value: unknown): ReminderPrefs {
  if (!value || typeof value !== "object") return DEFAULT_REMINDERS;
  const rec = value as Record<string, unknown>;
  return {
    bills: rec.bills !== false,
    budget: rec.budget !== false,
    summary: rec.summary === true,
  };
}

/** Body for PATCH /workspaces/:id/setup. Only the three reminder flags. */
export function remindersPatch(prefs: ReminderPrefs): { reminders: ReminderPrefs } {
  return {
    reminders: {
      bills: prefs.bills,
      budget: prefs.budget,
      summary: prefs.summary,
    },
  };
}
