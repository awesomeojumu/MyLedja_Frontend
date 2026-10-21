import { View } from "react-native";
import { Icon, Txt, useTheme } from "@/design";
import { PASSWORD_RULE_LABELS } from "@/features/auth-onboarding/auth-copy";
import type { PasswordRuleSet } from "@/features/auth-onboarding/services/password-rules";

/** The three password checks as chips that turn green as each one passes. */
export function PasswordRules({ rules }: { rules: PasswordRuleSet }) {
  const t = useTheme();
  const rows: { ok: boolean; label: string }[] = [
    { ok: rules.minLength, label: PASSWORD_RULE_LABELS.minLength },
    { ok: rules.hasNumber, label: PASSWORD_RULE_LABELS.hasNumber },
    { ok: rules.notNameOrEmail, label: PASSWORD_RULE_LABELS.notNameOrEmail },
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {rows.map((row) => (
        <View
          key={row.label}
          accessibilityLabel={`${row.label}: ${row.ok ? "done" : "not yet"}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 10,
            paddingVertical: 5,
            borderRadius: 999,
            backgroundColor: row.ok ? t.c.positiveSoft : t.c.surfaceAlt,
          }}
        >
          <Icon name={row.ok ? "check" : "circle-alert"} size={13} color={row.ok ? t.c.positive : t.c.inkMuted} />
          <Txt variant="caption" color={row.ok ? t.c.positive : t.c.inkMuted}>
            {row.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
