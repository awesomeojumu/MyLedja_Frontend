import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, Dialog, EmptyState, SegmentedControl, TextField, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Debt = {
  id: string;
  counterparty?: string;
  direction?: string;
  principal?: string;
  cadence?: string;
  nextDue?: string;
  anchorDay?: number;
  weekday?: number;
};

const NONE: Debt[] = [];
const CADENCE = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];

export function DebtsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listDebts(workspaceId)).data ?? []) as Debt[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "debts");
  return (
    <ScreenShell
      title="Debts"
      footer={
        <View style={{ gap: t.space.space3 }}>
          <Button fullWidth onPress={() => router.push("/(tabs)/plan/debt-owe")}>I owe someone</Button>
          <Button fullWidth variant="secondary" onPress={() => router.push("/(tabs)/plan/debt-owed")}>Someone owes me</Button>
        </View>
      }
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No debts yet" />
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {data.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/debt-detail?id=${row.id}`)}>
              <Txt variant="label">{row.counterparty}</Txt>
              <Amount value={nairaAmount(row.principal)} />
              <Txt variant="caption" color={t.c.inkMuted}>{row.direction === "owed_to_me" ? "Owed to me" : "I owe"}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function DebtFormScreen({ direction }: { direction: "i_owe" | "owed_to_me" }) {
  const router = useRouter();
  const { session, workspaces } = useSession();
  const [who, setWho] = useState("");
  const [principal, setPrincipal] = useState("0.00");
  const [whoError, setWhoError] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const owe = direction === "i_owe";
  return (
    <ScreenShell
      title={owe ? "Add debt I owe" : "Add money owed to me"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() => {
            if (!who.trim()) {
              setWhoError(owe ? "Say who you owe." : "Say who owes you.");
              return;
            }
            setWhoError(null);
            void run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              const created = await session.createDebt(workspaceId, { direction, counterparty: who.trim(), principal });
              router.replace(`/(tabs)/plan/debt-detail?id=${created.data.id}`);
            });
          }}
        >
          Save debt
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Who" value={who} onChangeText={setWho} error={whoError ?? undefined} />
      <AmountInput label="Principal" value={principal} onChange={setPrincipal} />
      <Txt variant="caption">
        {owe
          ? "Pay this person later from Add expense, category Loan repayments."
          : "When they pay you, use Add income, category Repayment received."}
      </Txt>
    </ScreenShell>
  );
}

function useDebt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getDebt(workspaceId, id)).data as Debt;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id ? `debt-${id}` : undefined) };
}

export function DebtDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useDebt();
  const owe = data?.direction === "i_owe";
  return (
    <ScreenShell title={String(data?.counterparty ?? "Debt")}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Amount value={nairaAmount(data.principal)} />
          <Txt variant="caption">{owe ? "I owe" : "Owed to me"}</Txt>
          {owe ? (
            <>
              <Button onPress={() => router.push(`/(tabs)/plan/debt-borrow?id=${id}`)}>Borrow</Button>
              <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/debt-repay?id=${id}`)}>Repay</Button>
            </>
          ) : (
            <>
              <Button onPress={() => router.push(`/(tabs)/plan/debt-lend?id=${id}`)}>Lend</Button>
              <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/debt-collect?id=${id}`)}>Collect</Button>
            </>
          )}
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/debt-schedule?id=${id}`)}>Schedule</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

function useAccounts() {
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => (await session.listAccounts(workspaceId)).data as { id?: string; name?: string }[], [session]);
  return useLiveQuery(load, [], "debt-accounts");
}

export function DebtBorrowScreen() {
  return <DebtMoveScreen kind="borrow" title="Borrow" />;
}

export function DebtLendScreen() {
  return <DebtMoveScreen kind="lend" title="Lend" />;
}

export function DebtCollectScreen() {
  return <DebtMoveScreen kind="collect" title="Collect" />;
}

function DebtMoveScreen({ kind, title }: { kind: "borrow" | "lend" | "collect"; title: string }) {
  const router = useRouter();
  const { id, data } = useDebt();
  const { session, workspaces } = useSession();
  const { data: accounts } = useAccounts();
  const [amount, setAmount] = useState("0.00");
  const [accountId, setAccountId] = useState("");
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const blocked = (kind === "borrow" && data?.direction !== "i_owe") || ((kind === "lend" || kind === "collect") && data?.direction !== "owed_to_me");
  const cashId = accountId || String(accounts.find((row) => row.id)?.id ?? "");
  return (
    <ScreenShell title={title}>
      {blocked ? <Banner tone="danger" title="This move does not fit this person." /> : null}
      {error ? <Banner tone="danger" title={error} /> : null}
      <Txt>{data?.counterparty}</Txt>
      <Amount value={nairaAmount(data?.principal)} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <SegmentedControl
        label="Account"
        value={cashId}
        onChange={setAccountId}
        options={accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name) }))}
      />
      <Dialog
        title={`${title} ${data?.counterparty ?? ""}?`}
        open={open}
        onClose={() => setOpen(false)}
        confirmLabel={title}
        onConfirm={() => {
          setOpen(false);
          void run(async () => {
            const workspaceId = workspaces[0]?.id;
            if (!workspaceId || !id) return;
            await session.debtMove(workspaceId, id, kind, { cashAccountId: cashId, amount, operationId: newId() });
            router.replace(`/(tabs)/plan/debt-detail?id=${id}`);
          });
        }}
      >
        {kind === "collect" ? "This is not income." : kind === "borrow" ? "This is not income." : "This is not an expense."}
      </Dialog>
      <Button fullWidth loading={busy} disabled={blocked} onPress={() => setOpen(true)}>
        {title}
      </Button>
    </ScreenShell>
  );
}

export function DebtRepayScreen() {
  const router = useRouter();
  const { id, data } = useDebt();
  const { session, workspaces } = useSession();
  const { data: accounts } = useAccounts();
  const [principal, setPrincipal] = useState("0.00");
  const [interest, setInterest] = useState("0.00");
  const [accountId, setAccountId] = useState("");
  const [open, setOpen] = useState(false);
  const { busy, error, run } = useSubmit();
  const remaining = nairaAmount(data?.principal);
  const cashId = accountId || String(accounts.find((row) => row.id)?.id ?? "");
  return (
    <ScreenShell title="Repay">
      {data?.direction !== "i_owe" ? <Banner tone="danger" title="This person is not someone you owe." /> : null}
      {error ? <Banner tone="danger" title={error} /> : null}
      <Txt>{data?.counterparty}</Txt>
      <AmountInput label="Principal" value={principal} onChange={setPrincipal} />
      <AmountInput label="Interest" value={interest} onChange={setInterest} />
      <SegmentedControl
        label="Account"
        value={cashId}
        onChange={setAccountId}
        options={accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name) }))}
      />
      <Dialog
        title="Repay this person?"
        open={open}
        onClose={() => setOpen(false)}
        confirmLabel="Repay"
        onConfirm={() => {
          setOpen(false);
          void run(async () => {
            const workspaceId = workspaces[0]?.id;
            if (!workspaceId || !id) return;
            if (nairaAmount(principal) > remaining) throw new Error("Principal is more than remaining.");
            await session.debtMove(workspaceId, id, "repay", {
              cashAccountId: cashId,
              principal,
              interest,
              operationId: newId(),
            });
            router.replace(`/(tabs)/plan/debt-detail?id=${id}`);
          });
        }}
      >
        Only the interest counts as Spent.
      </Dialog>
      <Button fullWidth loading={busy} onPress={() => setOpen(true)}>Repay</Button>
    </ScreenShell>
  );
}

export function DebtScheduleScreen() {
  const router = useRouter();
  const { id, data } = useDebt();
  const { session, workspaces } = useSession();
  const [cadenceOverride, setCadence] = useState<string | null>(null);
  const [dayOverride, setDay] = useState<string | null>(null);
  const { busy, run } = useSubmit();
  const cadence = cadenceOverride ?? String(data?.cadence ?? "monthly");
  const day = dayOverride ?? String(data?.anchorDay ?? 1);
  return (
    <ScreenShell
      title="Debt schedule"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.patchDebt(workspaceId, id, { cadence, anchorDay: Number(day) || 1, weekday: Number(day) || 1 });
              router.replace(`/(tabs)/plan/debt-detail?id=${id}`);
            })
          }
        >
          Save schedule
        </Button>
      }
    >
      <Txt>Next due {data?.nextDue}</Txt>
      <SegmentedControl label="Cadence" value={cadence} onChange={setCadence} options={CADENCE} />
      <TextField label="Day" value={day} onChangeText={setDay} />
      <Txt variant="caption">This is when it falls. It does not move cash.</Txt>
    </ScreenShell>
  );
}
