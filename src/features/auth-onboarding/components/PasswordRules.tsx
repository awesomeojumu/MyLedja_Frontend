import { View } from "react-native";
import { Icon, Txt, useTheme } from "../../../design";
import { PASSWORD_RULE_LABELS } from "../auth-copy";
import type { PasswordRuleSet } from "../services/password-rules";

export function PasswordRules({ rules }: { rules: PasswordRuleSet }) {
  const t = useTheme();
  const rows: { ok: boolean; label: string }[] = [
    { ok: rules.minLength, label: PASSWORD_RULE_LABELS.minLength },
    { ok: rules.hasNumber, label: PASSWORD_RULE_LABELS.hasNumber },
    { ok: rules.notNameOrEmail, label: PASSWORD_RULE_LABELS.notNameOrEmail },
  ];
  return (
    <View style={{ gap: 6 }}>
      {rows.map((row) => (
        <View key={row.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="circle-check" size={16} color={row.ok ? t.c.positive : t.c.inkMuted} />
          <Txt variant="caption" color={row.ok ? t.c.positive : t.c.inkMuted}>
            {row.label}
          </Txt>
        </View>
      ))}
    </View>
  );
}
