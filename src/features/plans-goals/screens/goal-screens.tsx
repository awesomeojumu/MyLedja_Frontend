import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, EmptyState, ProgressBar, SegmentedControl, TextField, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { newId } from "@/lib/ids";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { goalPace } from "@/features/plans-goals/services/goal-pace";
import { useSession } from "@/state";

export type Goal = {
  id: string;
  name?: string;
  target?: string;
  saved?: string;
  remaining?: string;
  completed?: boolean;
  fundingAccountId?: string | null;
  dueAt?: string | null;
  schedules?: { id: string; amount?: string; nextAt?: string }[];
};

function paceOf(row: Goal) {
  return goalPace({
    name: row.name,
    target: nairaAmount(row.target),
    saved: nairaAmount(row.saved),
    dueAt: row.dueAt,
  });
}

const NONE: Goal[] = [];

function useGoal() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getGoal(workspaceId, id)).data as Goal;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id ? `goal-${id}` : undefined) };
}

export function GoalsListScreen({ completed = false }: { completed?: boolean } = {}) {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listGoals(workspaceId)).data ?? []) as Goal[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "goals");
  const rows = data.filter((row) => Boolean(row.completed) === completed);
  const add = () => router.push("/(tabs)/plan/goal-add");
  const empty = completed ? "No completed goals." : "No goals yet";

  return (
    <ScreenShell
      title={completed ? "Completed goals" : "Goals"}
      actions={
        completed
          ? undefined
          : [{ icon: "check", label: "Completed", onPress: () => router.push("/(tabs)/plan/goals-completed") }]
      }
      footer={completed ? undefined : <Button fullWidth onPress={add}>Add goal</Button>}
    >
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : rows.length === 0 ? (
        <EmptyState title={empty} action={completed ? undefined : { label: "Add goal", onPress: add }} />
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {rows.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/goal-detail?id=${row.id}`)}>
              <Txt variant="label">{row.name}</Txt>
              <Amount value={nairaAmount(row.saved)} />
              <Txt variant="caption" color={t.c.inkMuted}>
                of {row.target}
                {(() => {
                  const pace = paceOf(row);
                  if (pace.daysLeft == null) return " · set a date";
                  if (pace.overdue) return " · date passed";
                  return ` · ${pace.daysLeft} days · ₦${(pace.perDay ?? 0).toFixed(2)} / day`;
                })()}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function GoalDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useGoal();
  return (
    <ScreenShell title={String(data?.name ?? "Goal")}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt>Saved</Txt>
          <Amount value={nairaAmount(data.saved)} />
          <Txt>Target</Txt>
          <Amount value={nairaAmount(data.target)} />
          <Txt>Remaining</Txt>
          <Amount value={nairaAmount(data.remaining)} />
          <Txt>Due</Txt>
          <Txt>{data.dueAt ? data.dueAt.slice(0, 10) : "Set a date"}</Txt>
          {(() => {
            const pace = paceOf(data);
            if (pace.daysLeft == null) return null;
            return (
              <>
                <Txt>Days left</Txt>
                <Txt variant="titleMd">{pace.overdue ? "0" : String(pace.daysLeft)}</Txt>
                <Txt>Need each day</Txt>
                <Amount value={pace.perDay ?? 0} />
              </>
            );
          })()}
          <Button onPress={() => router.push(`/(tabs)/plan/goal-edit?id=${id}`)}>Edit</Button>
          <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/goal-allocate?id=${id}`)}>Allocate</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/goal-schedule?id=${id}`)}>Schedule</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/goal-progress?id=${id}`)}>Progress</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function GoalFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const [name, setName] = useState("Emergency");
  const [target, setTarget] = useState("10000.00");
  const [dueAt, setDueAt] = useState("");
  const [accountId, setAccountId] = useState("");
  const { busy, error, run } = useSubmit();
  const loadAccounts = useCallback(
    async (workspaceId: string) =>
      ((await session.listAccounts(workspaceId)).data ?? []) as { id?: string; name?: string }[],
    [session],
  );
  const { data: accounts } = useLiveQuery(loadAccounts, [], "goal-accounts");
  const options = accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name ?? "Account") }));
  const load = useCallback(async (workspaceId: string) => {
    if (mode !== "edit" || !id) return null;
    const data = (await session.getGoal(workspaceId, id)).data as Goal;
    setName(String(data.name ?? "Goal"));
    setTarget(String(data.target ?? "0.00"));
    setDueAt(data.dueAt ? data.dueAt.slice(0, 10) : "");
    setAccountId(String(data.fundingAccountId ?? ""));
    return data;
  }, [id, mode, session]);
  useLiveQuery(load, null, mode === "edit" && id ? `goal-edit-${id}` : undefined);

  return (
    <ScreenShell
      title={mode === "add" ? "Add goal" : "Edit goal"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(dueAt)) {
                throw new Error("Set the due date as YYYY-MM-DD.");
              }
              const body = {
                name,
                target,
                fundingAccountId: accountId || options[0]?.value,
                dueAt: `${dueAt}T00:00:00.000Z`,
              };
              if (mode === "add") {
                await session.createGoal(workspaceId, body);
                router.replace("/(tabs)/plan/goals");
              } else if (id) {
                await session.patchGoal(workspaceId, id, body);
                router.back();
              }
            })
          }
        >
          Save
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <AmountInput label="Target" value={target} onChange={setTarget} />
      <TextField label="Due date" value={dueAt} onChangeText={setDueAt} helper="YYYY-MM-DD" />
      {options.length > 0 ? (
        <SegmentedControl
          label="Funding account"
          options={options.slice(0, 4)}
          value={accountId || options[0]?.value || ""}
          onChange={setAccountId}
        />
      ) : null}
    </ScreenShell>
  );
}

export function GoalAllocateScreen() {
  const router = useRouter();
  const { id, data } = useGoal();
  const { session, workspaces } = useSession();
  const [amount, setAmount] = useState("200.00");
  const [accountId, setAccountId] = useState("");
  const { busy, error, run } = useSubmit();
  const loadAccounts = useCallback(
    async (workspaceId: string) =>
      ((await session.listAccounts(workspaceId)).data ?? []) as { id?: string; name?: string }[],
    [session],
  );
  const { data: accounts } = useLiveQuery(loadAccounts, [], "goal-from-accounts");
  const options = accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name ?? "Account") }));

  return (
    <ScreenShell
      title={`Allocate ${data?.name ?? "goal"}`}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              const fromAccountId = accountId || options[0]?.value;
              if (!workspaceId || !id || !fromAccountId) return;
              await session.allocateGoal(workspaceId, id, { fromAccountId, amount, operationId: newId() });
              router.back();
            })
          }
        >
          Save
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      {options.length > 0 ? (
        <SegmentedControl
          label="From"
          options={options.slice(0, 4)}
          value={accountId || options[0]?.value || ""}
          onChange={setAccountId}
        />
      ) : null}
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
    </ScreenShell>
  );
}

export function GoalScheduleScreen() {
  const t = useTheme();
  const { id, data, refresh } = useGoal();
  const { session, workspaces } = useSession();
  const [amount, setAmount] = useState("50.00");
  const [nextAt, setNextAt] = useState("2026-11-01");
  const { busy, error, run } = useSubmit();

  return (
    <ScreenShell
      title="Goal schedule"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.scheduleGoal(workspaceId, id, { amount, nextAt: `${nextAt}T00:00:00.000Z` });
              refresh();
            })
          }
        >
          Save
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <AmountInput label="Amount" value={amount} onChange={setAmount} />
      <TextField label="Next date" value={nextAt} onChangeText={setNextAt} helper="YYYY-MM-DD" />
      {(data?.schedules ?? []).map((row) => (
        <Txt key={row.id} variant="caption" color={t.c.inkMuted}>
          {row.amount} · {row.nextAt?.slice(0, 10)}
        </Txt>
      ))}
    </ScreenShell>
  );
}

export function GoalProgressScreen() {
  const { data, loading } = useGoal();
  const target = nairaAmount(data?.target);
  const saved = nairaAmount(data?.saved);
  return (
    <ScreenShell title={String(data?.name ?? "Goal progress")}>
      {loading && !data ? <DefaultLoading /> : null}
      {target <= 0 ? (
        <EmptyState title="Set a target first" />
      ) : data ? (
        <>
          <ProgressBar label="Saved" value={saved} max={target} money currency="NGN" />
          <Txt>Saved</Txt>
          <Amount value={saved} />
          <Txt>Target</Txt>
          <Amount value={target} />
          {(() => {
            const pace = paceOf(data);
            if (pace.daysLeft == null) return <Txt>Set a date to see the daily pace.</Txt>;
            return (
              <Txt>
                {pace.overdue ? "Date passed." : `${pace.daysLeft} days left.`} Need ₦{(pace.perDay ?? 0).toFixed(2)} a day.
              </Txt>
            );
          })()}
        </>
      ) : null}
    </ScreenShell>
  );
}
