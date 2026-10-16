import { useState } from "react";
import { Button, Card, Txt, useTheme } from "../../../design";

/** Who is signed in, and the way out. Used on Settings and More. */
export function AccountCard({ email, onSignOut }: { email: string | null; onSignOut: () => Promise<void> }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  return (
    <Card flat title="Account">
      {email ? (
        <Txt variant="caption" color={t.c.inkMuted}>
          Signed in as {email}
        </Txt>
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
