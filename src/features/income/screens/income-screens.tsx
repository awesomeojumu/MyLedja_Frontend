import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, EmptyState, SegmentedControl, Sheet, TextField, Toast, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Stream = {
  id: string;
  name?: string;
  expected?: string;
  cadence?: string;
  taxClass?: string;
  received?: string;
  unmatchedCount?: number;
  unmatched?: { id: string; amount?: string; occurredAt?: string }[];
};

type Period = {
  expected?: string;
  received?: string;
  gap?: string;
  matches?: { transactionId: string; amount?: string; occurredAt?: string }[];
};

const NONE: Stream[] = [];
const CADENCE = [
  { value: "monthly", label: "Monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "yearly", label: "Yearly" },
];
const TAX = [
  { value: "paye", label: "PAYE" },
  { value: "business", label: "Business" },
  { value: "other", label: "Other" },
];

export function IncomeListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listIncomeStreams(workspaceId)).data ?? []) as Stream[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "income-streams");
  const add = () => router.push("/(tabs)/plan/income-add");
  return (
    <ScreenShell title="Income streams" footer={<Button fullWidth onPress={add}>Add income stream</Button>}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No income streams yet" action={{ label: "Add income stream", onPress: add }} />
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {data.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/plan/income-detail?id=${row.id}`)}>
              <Txt variant="label">{row.name}</Txt>
              <Amount value={nairaAmount(row.expected)} />
              <Txt variant="caption" color={t.c.inkMuted}>{row.cadence}</Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

function useStream() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getIncomeStream(workspaceId, id)).data as Stream;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id ? `stream-${id}` : undefined) };
}

export function IncomeFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id, data } = useStream();
  const { session, workspaces } = useSession();
  const [nameOverride, setName] = useState<string | null>(null);
  const [expectedOverride, setExpected] = useState<string | null>(null);
  const [cadenceOverride, setCadence] = useState<string | null>(null);
  const [taxOverride, setTaxClass] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  const name = nameOverride ?? (mode === "edit" ? String(data?.name ?? "Salary") : "Salary");
  const expected = expectedOverride ?? (mode === "edit" ? String(data?.expected ?? "0.00") : "250000.00");
  const cadence = cadenceOverride ?? (mode === "edit" ? String(data?.cadence ?? "monthly") : "monthly");
  const taxClass = taxOverride ?? (mode === "edit" ? String(data?.taxClass ?? "paye") : "paye");
  return (
    <ScreenShell
      title={mode === "add" ? "Add income stream" : "Edit income stream"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId) return;
              const body = { name, expected, cadence, taxClass };
              if (mode === "add") {
                const created = await session.createIncomeStream(workspaceId, body);
                router.replace(`/(tabs)/plan/income-detail?id=${created.data.id}`);
              } else if (id) {
                await session.patchIncomeStream(workspaceId, id, body);
                router.replace(`/(tabs)/plan/income-detail?id=${id}`);
              }
            })
          }
        >
          {mode === "add" ? "Save stream" : "Save changes"}
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <TextField label="Name" value={name} onChangeText={setName} />
      <AmountInput label="Expected" value={expected} onChange={setExpected} />
      <SegmentedControl label="Cadence" value={cadence} onChange={setCadence} options={CADENCE} />
      <SegmentedControl label="Tax class" value={taxClass} onChange={setTaxClass} options={TAX} />
      {mode === "add" ? (
        <Txt variant="caption">This is what you expect. Recorded pay is a transaction; match it on 080.</Txt>
      ) : null}
    </ScreenShell>
  );
}

export function IncomeDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useStream();
  return (
    <ScreenShell title={String(data?.name ?? "Income stream")}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Amount value={nairaAmount(data.expected)} />
          <Txt variant="caption">Expected</Txt>
          <Amount value={nairaAmount(data.received)} />
          <Txt variant="caption">Received</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            {data.cadence} · {data.taxClass}
          </Txt>
          <Button onPress={() => router.push(`/(tabs)/plan/income-edit?id=${id}`)}>Edit</Button>
          <Button variant="secondary" onPress={() => router.push(`/(tabs)/plan/income-tax?id=${id}`)}>Tax class</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/income-match?id=${id}`)}>Match</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/plan/income-expected?id=${id}`)}>Expected vs received</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function IncomeExpectedScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.incomeStreamPeriod(workspaceId, id)).data as Period;
  }, [id, session]);
  const { data, loading } = useLiveQuery(load, null, id ? `period-${id}` : undefined);
  const expected = nairaAmount(data?.expected);
  const received = nairaAmount(data?.received);
  return (
    <ScreenShell title="Expected vs received">
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Amount value={expected} />
          <Amount value={received} />
          {received < expected ? <Banner tone="warning" title="Not in yet" /> : null}
          {received > expected ? <Banner tone="positive" title="Received more than expected" /> : null}
          {(data.matches ?? []).map((row) => (
            <Pressable key={row.transactionId} onPress={() => router.push(`/(tabs)/transactions/${row.transactionId}`)}>
              <Txt>{row.occurredAt?.slice(0, 10)}</Txt>
              <Amount value={nairaAmount(row.amount)} />
            </Pressable>
          ))}
          <Button onPress={() => router.push(`/(tabs)/plan/income-match?id=${id}`)}>Match income</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function IncomeMatchScreen() {
  const router = useRouter();
  const { id, data, refresh } = useStream();
  const { session, workspaces } = useSession();
  const [pick, setPick] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const { busy, error, run } = useSubmit();
  return (
    <ScreenShell title="Match income">
      {error ? <Banner tone="danger" title={error} /> : null}
      {toast ? <Toast message={toast} tone="danger" onClose={() => setToast(null)} /> : null}
      {(data?.unmatched ?? []).map((row) => (
        <Pressable key={row.id} onPress={() => setPick(row.id)}>
          <Txt>{row.occurredAt?.slice(0, 10)}</Txt>
          <Amount value={nairaAmount(row.amount)} />
        </Pressable>
      ))}
      {(data?.unmatched ?? []).length === 0 ? <EmptyState title="No unmatched posted income" /> : null}
      <Sheet open={Boolean(pick)} onClose={() => setPick(null)} title="Match this pay?">
        <Button
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id || !pick) return;
              try {
                await session.matchIncome(workspaceId, id, pick);
                setPick(null);
                refresh();
                router.replace(`/(tabs)/plan/income-detail?id=${id}`);
              } catch (caught) {
                const reason = caught && typeof caught === "object" && "reason" in caught ? String((caught as { reason: string }).reason) : "";
                setToast(reason.includes("Already") ? "Already matched" : reason.includes("Amount") ? "Amount does not match." : caught instanceof Error ? caught.message : "Could not match");
                setPick(null);
              }
            })
          }
        >
          Match
        </Button>
      </Sheet>
    </ScreenShell>
  );
}

export function IncomeTaxScreen() {
  const router = useRouter();
  const { id, data } = useStream();
  const { session, workspaces } = useSession();
  const [taxOverride, setTaxClass] = useState<string | null>(null);
  const { busy, run } = useSubmit();
  const taxClass = taxOverride ?? String(data?.taxClass ?? "paye");
  return (
    <ScreenShell
      title="Tax class"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              if (!workspaceId || !id) return;
              await session.patchIncomeStream(workspaceId, id, { taxClass });
              router.replace(`/(tabs)/plan/income-detail?id=${id}`);
            })
          }
        >
          Save
        </Button>
      }
    >
      <SegmentedControl label="Tax class" value={taxClass} onChange={setTaxClass} options={TAX} />
      <Txt variant="caption">Used later for tax. Does not change expected.</Txt>
      <Button variant="tertiary" onPress={() => router.replace(`/(tabs)/plan/income-detail?id=${id}`)}>
        Not now
      </Button>
    </ScreenShell>
  );
}
