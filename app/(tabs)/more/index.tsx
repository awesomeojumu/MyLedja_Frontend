import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button, Txt, useTheme } from "../../../src/design";
import { AUTH_ROUTES, forgetSignup } from "../../../src/features/auth-onboarding";
import { LinkHub } from "../../../src/lib/link-hub";
import { MORE_LINKS } from "../../../src/lib/plan-links";
import { useSession } from "../../../src/state";

export default function MoreTab() {
  const t = useTheme();
  const router = useRouter();
  const { session, user } = useSession();
  const [busy, setBusy] = useState(false);
  return (
    <LinkHub
      title="More"
      links={MORE_LINKS}
      footer={
        <View style={{ gap: t.space.space2 }}>
          {user ? (
            <Txt variant="caption" color={t.c.inkMuted}>
              Signed in as {user.email}
            </Txt>
          ) : null}
          <Button
            fullWidth
            variant="secondary"
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await session.signOut();
              forgetSignup();
              router.replace(AUTH_ROUTES.welcome);
            }}
          >
            Sign out
          </Button>
        </View>
      }
    />
  );
}
