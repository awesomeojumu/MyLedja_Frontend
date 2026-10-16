import { Pressable, View } from "react-native";
import { Amount, CategoryIcon, Icon, StatusBadge, Txt, useTheme } from "../../../design";
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
      <CategoryIcon icon={account.icon} category={account.name} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="titleSm" numberOfLines={1} style={{ fontWeight: "500" }}>
          {account.name}
        </Txt>
        <Txt variant="bodySm" color={t.c.inkMuted} numberOfLines={1}>
          {account.statusLine}
        </Txt>
        {account.unsynced ? <StatusBadge status="pending" /> : null}
      </View>
      <Amount
        value={account.balance}
        currency={account.currency}
        hidden={hidden}
        kind={account.group === "liability" ? "expense" : "neutral"}
      />
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
