import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Amount,
  AmountInput,
  Banner,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  formatDateDMY,
  SegmentedControl,
  Select,
  TextField,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";
import { nairaAmount } from "@/lib/money-map";
import { billReminderContent } from "@/notifications/bill-reminders";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useActiveWorkspace } from "@/lib/ui/use-active-workspace";
import { InfoTip, StatusPill } from "@/lib/ui/common-widgets";

export type Bill = {
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
  category?: string;
  isSubscription?: boolean;
  paused?: boolean;
  exceptions?: { id: string; month: string; reason: string; adjustedAmount?: string }[];
};

type AccountItem = {
  id?: string;
  name?: string;
  kind?: string;
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

export function useBill() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getBill(workspaceId, id)).data as Bill;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id && activeWorkspace ? `bill-${id}` : undefined) };
}

/** 058 · Bills overview */
export function BillsListScreen({ filter: initialFilter = "all", title }: { filter?: "all" | "upcoming" | "missed"; title?: string } = {}) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const [filter, setFilter] = useState<"all" | "upcoming" | "missed">(initialFilter);
  const load = useCallback(async (workspaceId: string) => ((await session.listBills(workspaceId)).data ?? []) as Bill[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "bills");

  const totalMonthlyCommitment = data.reduce((sum, b) => {
    const val = nairaAmount(b.amount);
    if (b.cadence === "weekly") return sum + val * 4.33;
    if (b.cadence === "yearly") return sum + val / 12;
    return sum + val;
  }, 0);

  const upcomingBills = data.filter((b) => daysUntil(b.nextDue) >= 0 && daysUntil(b.nextDue) <= 14);
  const missedBills = data.filter(missed);

  const rows = data.filter((bill) => {
    if (filter === "upcoming") return daysUntil(bill.nextDue) >= 0 && daysUntil(bill.nextDue) <= 14;
    if (filter === "missed") return missed(bill);
    return true;
  });

  const add = () => router.push("/(tabs)/plan/bill-add");
  const empty =
    filter === "upcoming"
      ? "Nothing due in the next 14 days."
      : filter === "missed"
      ? "No missed bills."
      : "No bills yet";

  return (
    <ScreenShell
      title={title ?? (filter === "upcoming" ? "Upcoming bills" : filter === "missed" ? "Missed bills" : "Bills overview")}
      actions={[
        { icon: "calendar", label: "Calendar", onPress: () => router.push("/(tabs)/plan/bills-calendar") },
        { icon: "clock", label: "Upcoming", onPress: () => setFilter("upcoming") },
      ]}
      footer={<Button fullWidth onPress={add}>Add bill</Button>}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : rows.length === 0 && filter === "all" ? (
        <EmptyState title="No bills yet" action={{ label: "Add bill", onPress: add }}>
          Track rent, utilities, subscriptions and recurring expenses.
        </EmptyState>
      ) : (
        <View style={{ gap: t.space.space4 }}>
          {/* Summary Card */}
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="label">Monthly Recurring Commitment</Txt>
                <InfoTip text="Sum of all active recurring bills normalized to a monthly total." />
              </View>
              <Amount value={totalMonthlyCommitment} kind="expense" />

              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Upcoming (14d)</Txt>
                  <Txt variant="body" style={{ fontWeight: "600" }}>{upcomingBills.length} bills</Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt variant="caption" color={t.c.inkMuted}>Missed / Overdue</Txt>
                  <Txt variant="body" color={missedBills.length > 0 ? t.c.danger : t.c.ink} style={{ fontWeight: "600" }}>
                    {missedBills.length}
                  </Txt>
                </View>
              </View>
            </View>
          </Card>

          {/* Filter Chips */}
          <View style={{ flexDirection: "row", gap: t.space.space2 }}>
            <Chip selected={filter === "all"} onPress={() => setFilter("all")}>All ({data.length})</Chip>
            <Chip selected={filter === "upcoming"} onPress={() => setFilter("upcoming")}>Upcoming ({upcomingBills.length})</Chip>
            <Chip selected={filter === "missed"} onPress={() => setFilter("missed")}>Missed ({missedBills.length})</Chip>
          </View>

          {/* Quick Hub Links */}
          <View style={{ flexDirection: "row", gap: t.space.space2 }}>
            <Button variant="secondary" icon="calendar" onPress={() => router.push("/(tabs)/plan/bills-calendar")}>
              Calendar
            </Button>
            <Button variant="tertiary" icon="credit-card" onPress={() => router.push("/(tabs)/plan/subscriptions")}>
              Subscriptions
            </Button>
          </View>

          {/* Bills Feed */}
          {rows.length === 0 ? (
            <EmptyState title={empty} />
          ) : (
            <View style={{ gap: t.space.space3 }}>
              {rows.map((bill) => {
                const days = daysUntil(bill.nextDue);
                const isMissed = missed(bill);
                const isDueToday = days === 0;

                return (
                  <Pressable
                    key={bill.id}
                    onPress={() => router.push(`/(tabs)/plan/bill-detail?id=${bill.id}`)}
                    accessibilityRole="button"
                    accessibilityLabel={`${bill.name ?? "Bill"}, ${bill.cadence ?? "monthly"}, ₦${bill.amount}`}
                  >
                    <Card>
                      <View style={{ gap: t.space.space2 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Txt variant="body" style={{ fontWeight: "600" }}>{bill.name}</Txt>
                          {isMissed ? (
                            <StatusPill label="Missed" tone="danger" icon="triangle-alert" />
                          ) : isDueToday ? (
                            <StatusPill label="Due today" tone="warning" icon="clock" />
                          ) : days <= 3 && days > 0 ? (
                            <StatusPill label={`Due in ${days}d`} tone="warning" />
                          ) : (
                            <StatusPill label={bill.cadence ?? "monthly"} tone="neutral" />
                          )}
                        </View>

                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <Amount value={nairaAmount(bill.amount)} kind="expense" />
                          <Button
                            size="sm"
                            variant="secondary"
                            icon="check"
                            onPress={() => router.push(`/(tabs)/plan/bill-paid?id=${bill.id}`)}
                          >
                            Mark paid
                          </Button>
                        </View>
                        <Txt variant="caption" color={t.c.inkMuted}>
                          Due {formatDateDMY(bill.nextDue ?? "") || bill.nextDue}
                        </Txt>
                      </View>
                    </Card>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      )}
    </ScreenShell>
  );
}

/** 059 · Add bill */
export function BillAddScreen() {
  return <BillFormScreen mode="add" />;
}

/** 060 · Bill details */
export function BillDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useBill();
  const days = daysUntil(data?.nextDue);
  const isMissed = data ? missed(data) : false;

  return (
    <ScreenShell
      title={String(data?.name ?? "Bill details")}
      actions={[
        { icon: "pencil", label: "Edit", onPress: () => router.push(`/(tabs)/plan/bill-edit?id=${id}`) },
      ]}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}

      {data ? (
        <View style={{ gap: t.space.space4 }}>
          {/* Main Card */}
          <Card>
            <View style={{ gap: t.space.space3 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Txt variant="titleLg">{data.name}</Txt>
                <StatusPill
                  label={isMissed ? "Missed" : days === 0 ? "Due today" : days <= 3 ? `Due in ${days}d` : "Upcoming"}
                  tone={isMissed ? "danger" : days <= 3 ? "warning" : "positive"}
                />
              </View>

              <Amount value={nairaAmount(data.amount)} kind="expense" />

              <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: t.space.space2, borderTopWidth: 1, borderTopColor: t.c.border }}>
                <View>
                  <Txt variant="caption" color={t.c.inkMuted}>Cadence</Txt>
                  <Txt variant="body" style={{ fontWeight: "600" }}>{data.cadence ?? "Monthly"}</Txt>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Txt variant="caption" color={t.c.inkMuted}>Next due date</Txt>
                  <Txt variant="body" style={{ fontWeight: "600" }}>{formatDateDMY(data.nextDue ?? "") || data.nextDue}</Txt>
                </View>
              </View>

              {data.lastPaidAt ? (
                <Txt variant="caption" color={t.c.inkMuted}>
                  Last paid: {formatDateDMY(data.lastPaidAt)}
                </Txt>
              ) : null}
            </View>
          </Card>

          {/* Primary Action Buttons */}
          <Button fullWidth size="lg" icon="check" onPress={() => router.push(`/(tabs)/plan/bill-paid?id=${id}`)}>
            Mark paid
          </Button>

          <View style={{ flexDirection: "row", gap: t.space.space2 }}>
            <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/bill-skip?id=${id}`)}>
              Skip or postpone
            </Button>
            <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/bill-schedule?id=${id}`)}>
              Schedule
            </Button>
          </View>

          {/* Settings & History */}
          <Card>
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="label">Bill Management</Txt>
              <Button variant="tertiary" icon="bell" onPress={() => router.push(`/(tabs)/plan/bill-reminders?id=${id}`)}>
                Reminder settings
              </Button>
              <Button variant="tertiary" icon="clock" onPress={() => router.push(`/(tabs)/plan/bill-history?id=${id}`)}>
                Payment history
              </Button>
              <Button variant="tertiary" icon="settings" onPress={() => router.push(`/(tabs)/plan/bill-exceptions?id=${id}`)}>
                Recurrence exceptions
              </Button>
              <Button variant="tertiary" icon="pencil" onPress={() => router.push(`/(tabs)/plan/bill-edit?id=${id}`)}>
                Edit bill details
              </Button>
            </View>
          </Card>
        </View>
      ) : null}
    </ScreenShell>
  );
}

/** Form for Adding or Editing Bills (No demo values) */
export function BillFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("0.00");
  const [cadence, setCadence] = useState("monthly");
  const [day, setDay] = useState("1");
  const { busy, error, run } = useSubmit();

  const load = useCallback(async (workspaceId: string) => {
    if (mode !== "edit" || !id) return null;
    const res = await session.getBill(workspaceId, id);
    const data = res.data as Bill;
    setName(data.name ?? "");
    setAmount(data.amount ? nairaAmount(data.amount).toFixed(2) : "0.00");
    setCadence(data.cadence ?? "monthly");
    setDay(String(data.anchorDay ?? 1));
    return data;
  }, [id, mode, session]);
  useLiveQuery(load, null, mode === "edit" && id && activeWorkspace ? `bill-edit-${id}` : undefined);

  return (
    <ScreenShell
      title={mode === "add" ? "Add bill" : "Edit bill"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId) return;
              if (!name.trim()) throw new Error("Bill name is required.");
              if (nairaAmount(amount) <= 0) throw new Error("Amount must be greater than ₦0.00.");

              const body = {
                name: name.trim(),
                amount: nairaAmount(amount).toFixed(2),
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
      <View style={{ gap: 16 }}>
        <TextField
          label="Bill name"
          placeholder="e.g. Electricity, Internet, Gym"
          value={name}
          onChangeText={setName}
        />
        <AmountInput label="Amount" value={amount} onChange={setAmount} />
        <SegmentedControl label="Cadence" value={cadence} onChange={setCadence} options={CADENCE} />
        <TextField
          label="Recurring day"
          value={day}
          onChangeText={setDay}
          helper="Day of month (1–31) or weekday (0–6) if weekly"
        />
      </View>
    </ScreenShell>
  );
}

/** 061 · Edit recurring schedule */
export function BillScheduleScreen() {
  const router = useRouter();
  const { id, data } = useBill();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [cadence, setCadence] = useState(String(data?.cadence ?? "monthly"));
  const [day, setDay] = useState(String(data?.anchorDay ?? 1));
  const { busy, run } = useSubmit();

  return (
    <ScreenShell
      title="Edit recurring schedule"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId || !id) return;
              await session.patchBill(workspaceId, id, {
                cadence,
                anchorDay: Number(day) || 1,
                weekday: Number(day) || 1,
              });
              router.replace(`/(tabs)/plan/bill-detail?id=${id}`);
            })
          }
        >
          Save schedule
        </Button>
      }
    >
      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Current Schedule</Txt>
            <Txt variant="body">Next due: {formatDateDMY(data?.nextDue ?? "") || data?.nextDue}</Txt>
          </View>
        </Card>
        <SegmentedControl label="Cadence" value={cadence} onChange={setCadence} options={CADENCE} />
        <TextField
          label="Anchor day"
          value={day}
          onChangeText={setDay}
          helper="Day of month (1–31) on which payment is due."
        />
      </View>
    </ScreenShell>
  );
}

/** 062 · Mark bill paid */
export function BillPaidScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data } = useBill();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [accountId, setAccountId] = useState("");
  const [open, setOpen] = useState(false);
  const load = useCallback(async (workspaceId: string) => (await session.listAccounts(workspaceId)).data as AccountItem[], [session]);
  const { data: accounts } = useLiveQuery(load, [], "bill-accounts");
  const { busy, error, run } = useSubmit();

  const accountOptions = accounts
    .filter((a) => a.id)
    .map((a) => ({ value: String(a.id), label: String(a.name) }));

  return (
    <ScreenShell title="Mark bill paid">
      {error ? <Banner tone="danger" title={error} /> : null}
      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Bill</Txt>
            <Txt variant="titleMd">{data?.name}</Txt>
            <Amount value={nairaAmount(data?.amount)} kind="expense" />
            <Txt variant="caption" color={t.c.inkMuted}>Due {formatDateDMY(data?.nextDue ?? "") || data?.nextDue}</Txt>
          </View>
        </Card>

        <Select
          label="Payment account"
          value={accountId}
          options={accountOptions}
          onChange={setAccountId}
          placeholder="Choose account"
        />

        <Dialog
          title="Mark this bill paid?"
          open={open}
          onClose={() => setOpen(false)}
          confirmLabel="Mark paid"
          onConfirm={() => {
            setOpen(false);
            void run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId || !id) return;
              await session.markBillPaid(workspaceId, id, { accountId, operationId: newId() });
              router.replace(`/(tabs)/plan/bill-detail?id=${id}`);
            });
          }}
        >
          Posts one expense for {data?.name}.
        </Dialog>

        <Button fullWidth loading={busy} onPress={() => setOpen(true)}>
          Mark paid
        </Button>
      </View>
    </ScreenShell>
  );
}

/** 063 · Skip or postpone occurrence */
export function BillSkipPostponeScreen() {
  const router = useRouter();
  const { id, data, refresh } = useBill();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [mode, setMode] = useState<"skip" | "postpone">("skip");
  const [postponeDays, setPostponeDays] = useState("7");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { busy, run } = useSubmit();

  const handleAction = () => {
    run(async () => {
      const workspaceId = activeWorkspace?.workspaceId;
      if (!workspaceId || !id || !data?.nextDue) return;

      const currentDate = new Date(data.nextDue);
      let nextDueIso = data.nextDue;

      if (mode === "skip") {
        if (data.cadence === "weekly") {
          currentDate.setDate(currentDate.getDate() + 7);
        } else if (data.cadence === "yearly") {
          currentDate.setFullYear(currentDate.getFullYear() + 1);
        } else {
          currentDate.setMonth(currentDate.getMonth() + 1);
        }
        nextDueIso = currentDate.toISOString().slice(0, 10);
      } else {
        const days = parseInt(postponeDays, 10) || 7;
        currentDate.setDate(currentDate.getDate() + days);
        nextDueIso = currentDate.toISOString().slice(0, 10);
      }

      await session.patchBill(workspaceId, id, { nextDue: nextDueIso });
      refresh();
      setDialogOpen(false);
      router.back();
    });
  };

  return (
    <ScreenShell title="Skip or postpone occurrence">
      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Current Occurrence</Txt>
            <Txt variant="titleMd">{data?.name}</Txt>
            <Txt variant="body">Scheduled for {formatDateDMY(data?.nextDue ?? "") || data?.nextDue}</Txt>
          </View>
        </Card>

        <SegmentedControl
          label="Action"
          value={mode}
          onChange={(v) => setMode(v as "skip" | "postpone")}
          options={[
            { value: "skip", label: "Skip occurrence" },
            { value: "postpone", label: "Postpone due date" },
          ]}
        />

        {mode === "skip" ? (
          <Card>
            <Txt variant="body">
              Skipping advances this bill to the next cycle without recording an expense or marking it paid.
            </Txt>
          </Card>
        ) : (
          <View style={{ gap: 8 }}>
            <TextField
              label="Postpone by (days)"
              value={postponeDays}
              onChangeText={setPostponeDays}
              keyboardType="number-pad"
              helper="e.g. 7 days or 14 days"
            />
          </View>
        )}

        <Dialog
          title={mode === "skip" ? "Skip this occurrence?" : "Postpone this bill?"}
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          confirmLabel={mode === "skip" ? "Skip occurrence" : "Postpone"}
          onConfirm={handleAction}
        >
          {mode === "skip"
            ? `Are you sure you want to skip the current cycle for ${data?.name}? No transaction will be posted.`
            : `Postpone ${data?.name} by ${postponeDays} days?`}
        </Dialog>

        <Button fullWidth loading={busy} onPress={() => setDialogOpen(true)}>
          {mode === "skip" ? "Skip occurrence" : "Postpone due date"}
        </Button>
      </View>
    </ScreenShell>
  );
}

/** 064 · Payment history */
export function BillPaymentHistoryScreen() {
  const { id, data } = useBill();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return [];
    const txns = await session.listTransactions(workspaceId);
    return (txns.data.transactions ?? []).filter((tx) =>
      tx.description?.toLowerCase().includes(data?.name?.toLowerCase() ?? "")
    );
  }, [data?.name, id, session]);
  const { data: rows, loading } = useLiveQuery(load, [], id ? `bill-payments-${id}` : undefined);

  return (
    <ScreenShell title="Payment history">
      {loading && rows.length === 0 ? <DefaultLoading /> : null}
      {rows.length === 0 ? (
        <EmptyState title="No payment history recorded yet">
          Past payments logged for {data?.name ?? "this bill"} will appear here.
        </EmptyState>
      ) : (
        <View style={{ gap: 12 }}>
          {rows.map((row) => (
            <TransactionRow
              key={row.id}
              title={row.description ?? "Bill payment"}
              amount={nairaAmount(row.amount)}
              kind="expense"
            />
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

/** 065 · Reminder settings */
export function BillRemindersScreen() {
  const t = useTheme();
  const { user, session } = useSession();
  const { id, data } = useBill();
  const activeWorkspace = useActiveWorkspace();
  const hide = user?.hideLockScreenAmounts !== false;
  const [remind3d, setRemind3d] = useState(true);
  const [remind1d, setRemind1d] = useState(true);
  const [remindDue, setRemindDue] = useState(true);
  const { busy, run } = useSubmit();

  const load = useCallback(async (workspaceId: string) => {
    if (!id) return [];
    return (await session.listBillReminders(workspaceId, id)).data ?? [];
  }, [id, session]);
  const { data: rows, loading } = useLiveQuery(load, [], id && activeWorkspace ? `remind-${id}` : undefined);

  const preview = billReminderContent(
    { id: id ?? "", name: data?.name, amount: data?.amount, nextDue: data?.nextDue ?? "" },
    hide
  );

  return (
    <ScreenShell
      title="Reminder settings"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = activeWorkspace?.workspaceId;
              if (!workspaceId || !id) return;
              await session.patchBill(workspaceId, id, {
                remind3d,
                remind1d,
                remindDue,
              });
            })
          }
        >
          Save reminder settings
        </Button>
      }
    >
      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Notification Preview</Txt>
            <Txt variant="body" style={{ fontWeight: "600" }}>{preview.title}</Txt>
            <Txt variant="caption">{preview.body}</Txt>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>3 Days Before</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Advance alert to ensure sufficient funds</Txt>
            </View>
            <Chip selected={remind3d} onPress={() => setRemind3d(!remind3d)}>
              {remind3d ? "On" : "Off"}
            </Chip>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>1 Day Before</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Final warning before due date</Txt>
            </View>
            <Chip selected={remind1d} onPress={() => setRemind1d(!remind1d)}>
              {remind1d ? "On" : "Off"}
            </Chip>
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt variant="body" style={{ fontWeight: "600" }}>On Due Date</Txt>
              <Txt variant="caption" color={t.c.inkMuted}>Prompt to make payment today</Txt>
            </View>
            <Chip selected={remindDue} onPress={() => setRemindDue(!remindDue)}>
              {remindDue ? "On" : "Off"}
            </Chip>
          </View>
        </Card>

        {loading && rows.length === 0 ? <DefaultLoading /> : null}
      </View>
    </ScreenShell>
  );
}

/** 066 · Recurrence exceptions */
export function BillExceptionsScreen() {
  const t = useTheme();
  const { id, data, refresh } = useBill();
  const { session } = useSession();
  const activeWorkspace = useActiveWorkspace();
  const [reason, setReason] = useState("");
  const [month, setMonth] = useState("");
  const { busy, run } = useSubmit();

  const handleAddException = () => {
    run(async () => {
      const workspaceId = activeWorkspace?.workspaceId;
      if (!workspaceId || !id || !month.trim()) return;
      const current = data?.exceptions ?? [];
      const updated = [...current, { id: newId(), month: month.trim(), reason: reason.trim() }];
      await session.patchBill(workspaceId, id, { exceptions: updated });
      setReason("");
      setMonth("");
      refresh();
    });
  };

  return (
    <ScreenShell title="Recurrence exceptions">
      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Recurring Exceptions</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Define skipped occurrences, vacation pauses, or adjusted amounts for specific cycles.
            </Txt>
          </View>
        </Card>

        <Card>
          <View style={{ gap: 12 }}>
            <Txt variant="label">Add New Exception</Txt>
            <TextField label="Month / Period" placeholder="e.g. December 2026" value={month} onChangeText={setMonth} />
            <TextField label="Reason / Notes" placeholder="e.g. Holiday vacation shutdown" value={reason} onChangeText={setReason} />
            <Button loading={busy} onPress={handleAddException}>
              Add exception
            </Button>
          </View>
        </Card>

        {(data?.exceptions ?? []).length === 0 ? (
          <EmptyState title="No active exceptions">
            Standard {data?.cadence ?? "monthly"} schedule applies with no modifications.
          </EmptyState>
        ) : (
          (data?.exceptions ?? []).map((exc) => (
            <Card key={exc.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View>
                  <Txt variant="body" style={{ fontWeight: "600" }}>{exc.month}</Txt>
                  <Txt variant="caption" color={t.c.inkMuted}>{exc.reason}</Txt>
                </View>
                <StatusPill label="Skipped" tone="warning" />
              </View>
            </Card>
          ))
        )}
      </View>
    </ScreenShell>
  );
}

/** 150 · Subscription management */
export function SubscriptionManagementScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listBills(workspaceId)).data ?? []) as Bill[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "subscriptions");

  const subscriptions = data.filter((b) => b.isSubscription || b.cadence === "monthly" || b.cadence === "yearly");
  const monthlyTotal = subscriptions.reduce((sum, s) => {
    const val = nairaAmount(s.amount);
    return sum + (s.cadence === "yearly" ? val / 12 : val);
  }, 0);
  const annualTotal = monthlyTotal * 12;

  return (
    <ScreenShell
      title="Subscription management"
      footer={
        <Button fullWidth onPress={() => router.push("/(tabs)/plan/bill-add")}>
          Add subscription
        </Button>
      }
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && subscriptions.length === 0 ? <DefaultLoading /> : null}

      <View style={{ gap: 16 }}>
        <Card>
          <View style={{ gap: 8 }}>
            <Txt variant="label">Total Subscription Commitments</Txt>
            <Amount value={monthlyTotal} kind="expense" />
            <Txt variant="caption" color={t.c.inkMuted}>
              Equivalent to ₦{annualTotal.toLocaleString()} per year across {subscriptions.length} services.
            </Txt>
          </View>
        </Card>

        {subscriptions.length === 0 ? (
          <EmptyState title="No active subscriptions">
            Keep track of streaming, software, fitness, and recurring services here.
          </EmptyState>
        ) : (
          subscriptions.map((sub) => (
            <Pressable key={sub.id} onPress={() => router.push(`/(tabs)/plan/bill-detail?id=${sub.id}`)}>
              <Card>
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt variant="body" style={{ fontWeight: "600" }}>{sub.name}</Txt>
                    <StatusPill label={sub.cadence ?? "monthly"} tone="neutral" />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                    <Amount value={nairaAmount(sub.amount)} kind="expense" />
                    <Txt variant="caption" color={t.c.inkMuted}>
                      Renews {formatDateDMY(sub.nextDue ?? "") || sub.nextDue}
                    </Txt>
                  </View>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>
    </ScreenShell>
  );
}

/** Bill Calendar View */
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
