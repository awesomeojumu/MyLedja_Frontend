import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button, Card, Txt, useTheme } from "../../../design";
import { WidePane } from "../../../lib";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { INSTITUTIONS, accountById } from "../dummy-data";

export function ConnectionStatusScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, institution } = useLocalSearchParams<{ id?: string; institution?: string }>();
  const account = accountById(String(id ?? "gtbank"));
  const bank = INSTITUTIONS.find((item) => item.id === institution)?.name ?? account?.institution ?? "This bank";
  return (
    <AccountScreenShell
      title="Connection and sync"
      emptyTitle="Not connected"
      errorTitle="Could not reach this bank"
      footer={<Button fullWidth onPress={() => router.push(`/(tabs)/accounts/import?id=${account?.id ?? "gtbank"}`)}>Import a CSV instead</Button>}
    >
      <WidePane
        sidebar={
          <Banner tone="positive" title="Connected">
            {`${bank} is linked. Sync is a demo on this phone.`}
          </Banner>
        }
      >
      <Card>
        <Txt variant="titleSm">{account?.name ?? "Account"}</Txt>
        <Txt variant="bodySm" color={t.c.inkMuted}>
          Last sync {account?.lastActivity ?? "today"}. One record may still be waiting.
        </Txt>
      </Card>
      </WidePane>
    </AccountScreenShell>
  );
}
