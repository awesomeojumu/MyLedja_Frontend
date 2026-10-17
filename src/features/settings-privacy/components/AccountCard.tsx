import { useState } from "react";
import { Button, Card, Txt, useTheme } from "@/design";

/** Who is signed in, and the way out. Used on Settings and More. */
export function AccountCard({
  email,
  onSignOut,
  hideLockScreenAmounts = true,
  onHideAmounts,
}: {
  email: string | null;
  onSignOut: () => Promise<void>;
  hideLockScreenAmounts?: boolean;
  onHideAmounts?: (next: boolean) => Promise<void>;
}) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Card flat title="Account">
      {email ? (
        <Txt variant="caption" color={t.c.inkMuted}>
          Signed in as {email}
        </Txt>
      ) : null}
      <Txt variant="caption" color={t.c.inkMuted}>
        Hide lock-screen amounts: {hideLockScreenAmounts ? "on" : "off"}
      </Txt>
      {onHideAmounts ? (
        <Button
          fullWidth
          variant="secondary"
          onPress={() => {
            void onHideAmounts(!hideLockScreenAmounts);
          }}
        >
          {hideLockScreenAmounts ? "Show amounts on lock screen" : "Hide amounts on lock screen"}
        </Button>
      ) : null}
      <Button
        fullWidth
        variant="secondary"
        loading={busy}
        onPress={async () => {
          setBusy(true);
          try {
            await onSignOut();
          } finally {
            setBusy(false);
          }
        }}
      >
        Sign out
      </Button>
    </Card>
  );
}
