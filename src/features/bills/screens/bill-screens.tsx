import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, Dialog, EmptyState, formatDateDMY, SegmentedControl, TextField, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";
import { nairaAmount } from "@/lib/money-map";
import { billReminderContent } from "@/notifications/bill-reminders";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Bill = {
  id: string;
  name?: string;
  amount?: string;
  cadence?: string;
  nextDue?: string;
  dueFor?: string;
  lastPaidAt?: string | null;
  accountId?: string | null;
  anchorDay?: number;
  weekday?: number;
};

const NONE: Bill[] = [];
const CADENCE = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];

function daysUntil(iso?: string) {
  if (!iso) return 99;
  const a = new Date(`${iso}T00:00:00.000Z`).getTime();
  const b = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z").getTime();
  return Math.round((a - b) / 86400000);
}

function missed(bill: Bill) {
  const today = new Date().toISOString().slice(0, 10);
  if (!bill.dueFor || bill.dueFor >= today) return false;
  if (!bill.lastPaidAt) return true;
  return bill.lastPaidAt.slice(0, 10) < bill.dueFor;
}

export function BillsListScreen({ filter = "all", title }: { filter?: "all" | "upcoming" | "missed"; title?: string }) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listBills(workspaceId)).data ?? []) as Bill[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "bills");
  const rows = data.filter((bill) => {
    if (filter === "upcoming") return daysUntil(bill.nextDue) >= 0 && daysUntil(bill.nextDue) <= 14;
    if (filter === "missed") return missed(bill);
    return true;
  });
  const add = () => router.push("/(tabs)/plan/bill-add");
  const empty =
    filter === "upcoming" ? "Nothing due in the next 14 days." : filter === "missed" ? "No missed bills." : "No bills yet";

  return (
    <ScreenShell
      title={title ?? (filter === "upcoming" ? "Upcoming bills" : filter === "missed" ? "Missed bills" : "Bills")}
      actions={
        filter === "all"
          ? [
              { icon: "clock", label: "Upcoming", onPress: () => router.push("/(tabs)/plan/bills-upcoming") },
              { icon: "triangle-alert", label: "Missed", onPress: () => router.push("/(tabs)/plan/bills-missed") },
              { icon: "calendar", label: "Calendar", onPress: () => router.push("/(tabs)/plan/bills-calendar") },
            ]
          : undefined
      }
      footer={filter === "all" ? <Button fullWidth onPress={add}>Add bill</Button> : undefined}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : rows.length === 0 ? (
        <EmptyState title={empty} action={filter === "all" ? { label: "Add bill", onPress: add } : undefined} />
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {rows.map((bill) => (
            <Pressable key={bill.id} onPress={() => router.push(`/(tabs)/plan/bill-detail?id=${bill.id}`)}>
              <Txt variant="label">{bill.name}{filter === "missed" ? " · Missed" : ""}</Txt>
              <Amount value={nairaAmount(bill.amount)} />
              <Txt variant="caption" color={t.c.inkMuted}>{formatDateDMY(bill.nextDue ?? "") || bill.nextDue}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function BillFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("DSTV");
  const [amount, setAmount] = useState("50.00");
  const [cadence, setCadence] = useState("monthly");
  const [day, setDay] = useState("1");
  const { busy, error, run } = useSubmit();

  return (
    <ScreenShell
      title={mode === "add" ? "Add bill" : "Edit bill"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              const body = {
                name,
                amount,
                cadence,
                anchorDay: Number(day) || 1,
                weekday: Number(day) || 1,
              };
              if (mode === "add") {
                await session.createBill(workspaceId, body);
                router.replace("/(tabs)/plan/bills");
              } else if (id) {
                await session.patchBill(workspaceId, id, body);
                router.back();
              }
            })
          }
        >
          {mode === "add" ? "Save bill" : "Save changes"}
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <SegmentedControl label="Cadence" value={cadence} onChange={setCadence} options={CADENCE} />
      <TextField label="Day" value={day} onChangeText={setDay} helper="1–31, or weekday 0–6 if weekly" />
    </ScreenShell>
  );
}

function useBill() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getBill(workspaceId, id)).data as Bill;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id ? `bill-${id}` : undefined) };
}

export function BillDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useBill();
  return (
    <ScreenShell title={String(data?.name ?? "Bill")}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Amount value={nairaAmount(data.amount)} />
          <Txt variant="caption" color={t.c.inkMuted}>
            {data.cadence} · next {formatDateDMY(data.nextDue ?? "") || data.nextDue}
          </Txt>
          <Button onPress={() => router.push(`/(tabs)/plan/bill-paid?id=${id}`)}>Mark paid</Button>
          <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/bill-edit?id=${id}`)}>Edit</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/bill-schedule?id=${id}`)}>Schedule</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/bill-reminders?id=${id}`)}>Reminders</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function BillScheduleScreen() {
  const router = useRouter();
  const { id, data } = useBill();
  const { session, workspaces } = useSession();
  const [cadence, setCadence] = useState(String(data?.cadence ?? "monthly"));
  const [day, setDay] = useState(String(data?.anchorDay ?? 1));
  const { busy, run } = useSubmit();
  return (
    <ScreenShell
      title="Bill schedule"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.patchBill(workspaceId, id, { cadence, anchorDay: Number(day) || 1, weekday: Number(day) || 1 });
              router.replace(`/(tabs)/plan/bill-detail?id=${id}`);
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
    </ScreenShell>
  );
}

export function BillPaidScreen() {
  const router = useRouter();
  const { id, data } = useBill();
  const { session, workspaces } = useSession();
  const [accountId, setAccountId] = useState("");
  const [open, setOpen] = useState(false);
  const load = useCallback(async (workspaceId: string) => (await session.listAccounts(workspaceId)).data as { id?: string; name?: string }[], [session]);
  const { data: accounts } = useLiveQuery(load, [], "bill-accounts");
  const { busy, error, run } = useSubmit();

  return (
    <ScreenShell title="Mark bill paid">
      {error ? <Banner tone="danger" title={error} /> : null}
      <Amount value={nairaAmount(data?.amount)} />
      <Txt>Due {data?.nextDue}</Txt>
      <SegmentedControl
        label="Account"
        value={accountId}
        onChange={setAccountId}
        options={accounts.filter((a) => a.id).map((a) => ({ value: String(a.id), label: String(a.name) }))}
      />
      <Dialog title="Mark this bill paid?" open={open} onClose={() => setOpen(false)} confirmLabel="Mark paid" onConfirm={() => {
        setOpen(false);
        void run(async () => {
          const workspaceId = workspaces[0]?.id;
          if (!workspaceId || !id) return;
          await session.markBillPaid(workspaceId, id, { accountId, operationId: newId() });
          router.replace(`/(tabs)/plan/bill-detail?id=${id}`);
        });
      }}>
        Posts one expense for {data?.name}.
      </Dialog>
      <Button fullWidth loading={busy} onPress={() => setOpen(true)}>Mark paid</Button>
    </ScreenShell>
  );
}

export function BillRemindersScreen() {
  const { user } = useSession();
  const { id, data } = useBill();
  const { session } = useSession();
  const hide = user?.hideLockScreenAmounts !== false;
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return [];
    return (await session.listBillReminders(workspaceId, id)).data ?? [];
  }, [id, session]);
  const { data: rows, loading } = useLiveQuery(load, [], id ? `remind-${id}` : undefined);
  return (
    <ScreenShell title="Bill reminders">
      {loading && rows.length === 0 ? <DefaultLoading /> : null}
      {rows.length === 0 ? (
        <EmptyState title="No reminders yet." />
      ) : (
        rows.map((row, i) => {
          const copy = billReminderContent({ id: id ?? "", name: data?.name, amount: data?.amount, nextDue: String(row.dueDate) }, hide);
          return (
            <View key={`${row.dueDate}-${i}`}>
              <Txt>{copy.title}</Txt>
              <Txt variant="caption">{copy.body}</Txt>
            </View>
          );
        })
      )}
    </ScreenShell>
  );
}

export function BillCalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listBills(workspaceId)).data ?? []) as Bill[], [session]);
  const { data } = useLiveQuery(load, NONE, "bills-cal");
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startPad = first.getUTCDay();
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: { label: string; iso?: string }[] = Array.from({ length: startPad }, () => ({ label: "" }));
  for (let d = 1; d <= days; d += 1) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ label: String(d), iso });
  }
  const byDay = new Map<string, Bill[]>();
  for (const bill of data) {
    if (!bill.nextDue) continue;
    byDay.set(bill.nextDue, [...(byDay.get(bill.nextDue) ?? []), bill]);
  }

  return (
    <ScreenShell title="Bill calendar">
      <Txt variant="label">
        {now.toLocaleString("en-NG", { month: "long", year: "numeric" })}
      </Txt>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => {
          const hits = cell.iso ? byDay.get(cell.iso) ?? [] : [];
          return (
            <Pressable
              key={`${cell.iso ?? "p"}-${i}`}
              style={{ width: "14%", minHeight: 44, padding: 4 }}
              onPress={hits[0] ? () => router.push(`/(tabs)/plan/bill-detail?id=${hits[0].id}`) : undefined}
            >
              <Txt variant="caption">{cell.label}</Txt>
              {hits.length ? <Txt variant="caption" color={t.c.primary}>•</Txt> : null}
            </Pressable>
          );
        })}
      </View>
    </ScreenShell>
  );
}
