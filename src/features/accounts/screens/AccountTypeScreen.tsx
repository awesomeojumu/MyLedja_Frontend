import { View } from "react-native";
import { Txt, useTheme } from "@/design";
import { AccountScreenShell } from "@/features/accounts/components/AccountScreenShell";

const KINDS = ["cash", "savings", "liability", "receivable"] as const;

export function AccountTypeScreen() {
  const t = useTheme();
  return (
    <AccountScreenShell title="Account type" showBack>
      <View style={{ gap: t.space.space2 }}>
        {KINDS.map((kind) => (
          <Txt key={kind} variant="body">
            {kind}
          </Txt>
        ))}
      </View>
    </AccountScreenShell>
  );
}
