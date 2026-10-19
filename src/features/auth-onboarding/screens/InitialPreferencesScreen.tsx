import { useState } from "react";
import { Pressable, View } from "react-native";
import { Banner, Button, SegmentedControl, Select, Txt, useTheme, a11yState } from "@/design";
import { AuthShell } from "@/features/auth-onboarding/components/AuthShell";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import type { InitialPreferences } from "@/features/auth-onboarding/services/preferences-patch";

export function InitialPreferencesScreen({
  onBack,
  onSubmit,
}: {
  onBack?: () => void;
  onSubmit: (prefs: InitialPreferences) => void | Promise<void>;
}) {
  const t = useTheme();
  const { busy, error, run } = useSubmit();
  const [currency, setCurrency] = useState("NGN");
  const [locale, setLocale] = useState("en-NG");
  const [zone, setZone] = useState("Africa/Lagos");
  const [weekStart, setWeekStart] = useState<"monday" | "sunday">("monday");
  const [bills, setBills] = useState(true);
  const [budget, setBudget] = useState(true);
  const [summary, setSummary] = useState(false);
  const save = () =>
    run(async () => {
      await onSubmit({
        currency,
        locale,
        timezone: zone,
        weekStartsOn: weekStart,
        reminders: { bills, budget, summary },
      });
    });
  return (
    <AuthShell
      brand="setup"
      step={{ label: "Set up", current: 1, total: 3 }}
      onBack={onBack}
      title="How money should look"
      subtitle="Change these any time in Settings."
      footer={
        <Button fullWidth size="lg" loading={busy} onPress={save}>
          Continue
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <Select
        label="Main currency"
        value={currency}
        onChange={setCurrency}
        helper="Amounts will look like ₦1,250,450.50"
        options={[{ value: "NGN", label: "Nigerian naira (₦)" }]}
      />
      <Select
        label="Language and region"
        value={locale}
        onChange={setLocale}
        options={[{ value: "en-NG", label: "English (Nigeria)" }]}
      />
      <Select
        label="Time zone"
        value={zone}
        onChange={setZone}
        helper="Detected from this device."
        options={[{ value: "Africa/Lagos", label: "West Africa Time (Lagos)" }]}
      />
      <View style={{ gap: 8 }}>
        <Txt variant="label">Weeks start on</Txt>
        <SegmentedControl
          label="Weeks start on"
          options={[
            { value: "monday", label: "Monday" },
            { value: "sunday", label: "Sunday" },
          ]}
          value={weekStart}
          onChange={(value) => setWeekStart(value === "sunday" ? "sunday" : "monday")}
        />
      </View>
      <Txt variant="overline" color={t.c.inkMuted}>
        Reminders
      </Txt>
      <ToggleRow title="Bills due" caption="A day before each bill is due" value={bills} onChange={setBills} />
      <ToggleRow title="Budget alerts" caption="When a budget reaches 80%" value={budget} onChange={setBudget} />
      <ToggleRow title="Weekly summary" caption="Sunday evening, what came in and went out" value={summary} onChange={setSummary} />
      <ToggleRow title="Security alerts" caption="Always on: new sign-ins and password changes" value onChange={() => {}} disabled />
    </AuthShell>
  );
}

function ToggleRow({
  title,
  caption,
  value,
  onChange,
  disabled,
}: {
  title: string;
  caption: string;
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, opacity: disabled ? 0.55 : 1 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="label" style={{ fontWeight: "600" }}>
          {title}
        </Txt>
        <Txt variant="caption" color={t.c.inkMuted}>
          {caption}
        </Txt>
      </View>
      <Pressable
        onPress={disabled ? undefined : () => onChange(!value)}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityLabel={title}
        {...a11yState({ checked: value, disabled: !!disabled })}
        style={{
          width: 48,
          height: 28,
          borderRadius: 999,
          padding: 3,
          justifyContent: "center",
          backgroundColor: disabled ? t.c.primarySoft : value ? t.c.primary : t.c.border,
        }}
      >
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: t.c.surface,
            alignSelf: value ? "flex-end" : "flex-start",
          }}
        />
      </Pressable>
    </View>
  );
}
