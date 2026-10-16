import { useLocalSearchParams, useRouter } from "expo-router";
import { Banner, Button } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { ACCOUNT_ACTIVITY, accountById } from "../dummy-data";

export function ArchiveAccountScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const account = accountById(String(id ?? "gtbank")) ?? accountById("gtbank");
  const count = ACCOUNT_ACTIVITY[account?.id ?? ""]?.length ?? 0;

  return (
    <AccountScreenShell
      title={`Archive ${account?.name ?? "account"}?`}
      emptyTitle="This account is not on this workspace"
      errorTitle="Could not archive this account"
      footer={
        <Button
          variant="destructive"
          fullWidth
          onPress={() => router.replace("/(tabs)/accounts")}
        >
          Archive account
        </Button>
      }
    >
      <Banner tone="danger" title="Hidden from lists">
        {`${account?.name ?? "This account"} and its ${count} recent dummy rows stay in the workspace. You can restore it later.`}
      </Banner>
    </AccountScreenShell>
  );
}
