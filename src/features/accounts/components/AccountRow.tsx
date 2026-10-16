import { Pressable, View } from "react-native";
import { Amount, CategoryIcon, Icon, StatusBadge, Txt, useTheme } from "../../../design";
import { kindLabel } from "../dummy-data";
import type { LedgerAccount } from "../types/account";

export function AccountRow({
  account,
  hidden,
  onPress,
}: {
  account: LedgerAccount;
  hidden?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  const meta = [kindLabel(account.kind), account.lastFour ? `•••• ${account.lastFour}` : account.institution]
    .filter(Boolean)
    .join(" · ");
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        minHeight: 64,
        paddingVertical: 12,
        paddingHorizontal: 16,
        backgroundColor: t.c.surface,
        borderBottomWidth: 1,
        borderBottomColor: t.c.border,
      }}
    >
      <CategoryIcon icon={account.icon} category={kindLabel(account.kind)} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>
          {account.name}
        </Txt>
        <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>
          {meta}
        </Txt>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Amount value={account.balance} currency={account.currency} hidden={hidden} />
        {account.reconciled ? <StatusBadge status="reconciled" /> : <Txt variant="caption" color={t.c.inkMuted}>{account.lastActivity}</Txt>}
      </View>
      <Icon name="chevron-right" size={18} color={t.c.inkMuted} />
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={account.name} accessibilityHint="Opens the account">
      {body}
    </Pressable>
  ) : (
    body
  );
}
