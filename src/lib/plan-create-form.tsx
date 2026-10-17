import { useEffect, useState } from "react";
import { Button, SegmentedControl, TextField } from "@/design";
import { afterMoneyWrite } from "@/lib/after-money";
import { newId } from "@/lib/ids";
import { useSession } from "@/state";

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
  const { session, workspaces } = useSession();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.value ?? ""])),
  );
  const [accounts, setAccounts] = useState<{ id: string; name: string }[]>([]);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const workspaceId = workspaces[0]?.id;
    if (!pickAccount || !workspaceId) return;
    void session.listAccounts(workspaceId).then((res) => {
      const rows = (Array.isArray(res.data) ? res.data : []).map((row) => {
        const rec = row as { id?: string; name?: string };
        return { id: String(rec.id ?? ""), name: String(rec.name ?? rec.id) };
      });
      setAccounts(rows);
      if (rows[0]) setAccountId(rows[0].id);
    });
  }, [pickAccount, session, workspaces]);

  return (
    <>
      {pickAccount && accounts.length > 0 ? (
        <SegmentedControl
          label="Account"
          options={accounts.map((row) => ({ value: row.id, label: row.name }))}
          value={accountId}
          onChange={setAccountId}
        />
      ) : null}
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
        onPress={() => {
          const workspaceId = workspaces[0]?.id;
          if (!workspaceId) return;
          setBusy(true);
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
            .finally(() => setBusy(false));
        }}
      >
        Save
      </Button>
    </>
  );
}
