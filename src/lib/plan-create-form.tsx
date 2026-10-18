import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Banner, Button, SegmentedControl, TextField } from "@/design";
import { afterMoneyWrite, onMoneyWrite } from "@/lib/after-money";
import { fetchScoped, readScoped } from "@/lib/cached-fetch";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

type Option = { id: string; name: string };

export function PlanCreateForm({
  path,
  fields,
  extra,
  pickAccount,
  onSaved,
}: {
  path: string;
  fields: { key: string; label: string; value?: string }[];
  extra?: Record<string, unknown>;
  pickAccount?: boolean;
  onSaved?: () => void;
}) {
  const { session, workspaces, user } = useSession();
  const workspaceId = workspaces[0]?.id;
  const userId = user?.userId;
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.value ?? ""])),
  );
  const [accounts, setAccounts] = useState<Option[]>(() =>
    userId && workspaceId ? readScoped<Option[]>(userId, workspaceId, "account-options") ?? [] : [],
  );
  const [accountId, setAccountId] = useState(() => accounts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = useCallback(() => {
    if (!pickAccount || !workspaceId || !userId) return;
    void fetchScoped<Option[]>(userId, workspaceId, "account-options", async () => {
      const res = await session.listAccounts(workspaceId);
      return (Array.isArray(res.data) ? res.data : [])
        .map((row) => row as { id?: string; name?: string })
        .filter((row) => row.id)
        .map((row) => ({ id: String(row.id), name: String(row.name ?? "Account") }));
    }).then(({ data }) => {
      if (!data) return;
      setAccounts(data);
      setAccountId((current) => (data.some((row) => row.id === current) ? current : data[0]?.id ?? ""));
    });
  }, [pickAccount, session, userId, workspaceId]);

  // Reload on focus and after any money write, so an account added elsewhere (or a reconnect) is picked up.
  useFocusEffect(
    useCallback(() => {
      loadAccounts();
      return onMoneyWrite(() => loadAccounts());
    }, [loadAccounts]),
  );

  const needsAccount = Boolean(pickAccount) && !accountId;

  return (
    <>
      {error ? <Banner tone="danger" title="Couldn't save">{error}</Banner> : null}
      {pickAccount && accounts.length > 0 ? (
        <SegmentedControl
          label="Account"
          options={accounts.map((row) => ({ value: row.id, label: row.name }))}
          value={accountId}
          onChange={setAccountId}
        />
      ) : null}
      {needsAccount ? <Banner tone="primary" title="Add an account first">A budget follows one account. Add one in Accounts.</Banner> : null}
      {fields.map((field) => (
        <TextField
          key={field.key}
          label={field.label}
          value={values[field.key] ?? ""}
          onChangeText={(next) => setValues({ ...values, [field.key]: next })}
        />
      ))}
      <Button
        fullWidth
        loading={busy}
        disabled={needsAccount}
        disabledReason={needsAccount ? "Add an account first." : undefined}
        onPress={() => {
          if (!workspaceId) return;
          setBusy(true);
          setError(null);
          void session
            .postCollection(workspaceId, path, {
              ...extra,
              ...values,
              ...(pickAccount ? { accountId } : {}),
              operationId: newId(),
            })
            .then(() => {
              afterMoneyWrite();
              onSaved?.();
            })
            .catch((caught: unknown) => {
              setError(caught instanceof Error && caught.message ? caught.message : "Something went wrong. Try again.");
            })
            .finally(() => setBusy(false));
        }}
      >
        Save
      </Button>
    </>
  );
}
