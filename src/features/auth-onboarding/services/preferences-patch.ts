export type ReminderPrefs = {
  bills: boolean;
  budget: boolean;
  summary: boolean;
};

export type InitialPreferences = {
  currency: string;
  locale: string;
  timezone: string;
  weekStartsOn: "monday" | "sunday";
  reminders: ReminderPrefs;
};

export function preferencesPatch(input: InitialPreferences) {
  return {
    defaultCurrency: input.currency,
    locale: input.locale,
    timezone: input.timezone,
    weekStartsOn: input.weekStartsOn,
    reminders: {
      bills: input.reminders.bills,
      budget: input.reminders.budget,
      summary: input.reminders.summary,
    },
    setupProgress: { currency: true },
  };
}
