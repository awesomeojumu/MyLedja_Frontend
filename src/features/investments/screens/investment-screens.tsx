import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Amount, AmountInput, Banner, Button, EmptyState, SegmentedControl, TextField, Txt, useTheme } from "@/design";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { dashboardBounds } from "@/features/dashboard/services/range-cache";
import { newId } from "@/lib/ids";
import { splitCopy, splitInvestmentReturn } from "@/features/investments/services/return-split";
import { nairaAmount } from "@/lib/money-map";
import { LiveNotice } from "@/lib/live-notice";
import { ScreenShell } from "@/lib/screen-shell";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

type Holding = {
  id: string;
  name?: string;
  accountId?: string;
  quantity?: string;
  capital?: string;
  cost?: string;
  price?: string | null;
  value?: string;
  maturesAt?: string | null;
  dividends?: string;
  lots?: { id: string; quantity?: string; cost?: string; at?: string }[];
};

type Account = { id?: string; name?: string };
const NONE: Holding[] = [];

function useHolding() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    return (await session.getHolding(workspaceId, id)).data as Holding;
  }, [id, session]);
  return { id, ...useLiveQuery(load, null, id ? `holding-${id}` : undefined) };
}

function useAccounts() {
  const { session } = useSession();
  const load = useCallback(
    async (workspaceId: string) => ((await session.listAccounts(workspaceId)).data ?? []) as Account[],
    [session],
  );
  return useLiveQuery(load, [], "holding-accounts");
}

export function HoldingsListScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const load = useCallback(async (workspaceId: string) => ((await session.listHoldings(workspaceId)).data ?? []) as Holding[], [session]);
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, NONE, "holdings");
  const add = () => router.push("/(tabs)/more/holding-add");
  return (
    <ScreenShell title="Investments" footer={<Button fullWidth onPress={add}>Add holding</Button>}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && data.length === 0 ? (
        <DefaultLoading />
      ) : data.length === 0 ? (
        <EmptyState title="No holdings yet" action={{ label: "Add holding", onPress: add }} />
      ) : (
        <View style={{ gap: t.space.space3 }}>
          {data.map((row) => (
            <Pressable key={row.id} onPress={() => router.push(`/(tabs)/more/holding-detail?id=${row.id}`)}>
              <Txt variant="label">{row.name}</Txt>
              <Amount value={nairaAmount(row.value ?? row.capital ?? row.cost)} />
              <Txt variant="caption" color={t.c.inkMuted}>
                Qty {row.quantity}
                {row.maturesAt ? ` · matures ${row.maturesAt.slice(0, 10)}` : ""}
              </Txt>
            </Pressable>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

export function HoldingDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id, data, loading, offline, error, known, refresh } = useHolding();
  return (
    <ScreenShell title={String(data?.name ?? "Holding")}>
      <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
      {loading && !data ? <DefaultLoading /> : null}
      {data ? (
        <View style={{ gap: t.space.space3 }}>
          <Txt>Quantity</Txt>
          <Txt variant="titleMd">{data.quantity}</Txt>
          <Txt>Value today</Txt>
          <Amount value={nairaAmount(data.value ?? data.capital ?? data.cost)} />
          <Txt>Price each</Txt>
          <Amount value={nairaAmount(data.price)} />
          <Txt>Capital placed</Txt>
          <Amount value={nairaAmount(data.capital ?? data.cost)} />
          <Txt>Matures</Txt>
          <Txt variant="body">{data.maturesAt ? data.maturesAt.slice(0, 10) : "No date"}</Txt>
          <Txt>Dividends received</Txt>
          <Amount value={nairaAmount(data.dividends)} kind="income" />
          <Banner tone="primary" title="Capital is not spending.">
            Money left cash to sit in this holding until it comes back.
          </Banner>
          <Button onPress={() => router.push(`/(tabs)/more/holding-buy?id=${id}`)}>Place capital</Button>
          <Button variant="secondary" onPress={() => router.push(`/(tabs)/more/holding-sell?id=${id}`)}>Record return</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/more/holding-dividend?id=${id}`)}>Record dividend</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/more/holding-edit?id=${id}`)}>Edit</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/more/holding-performance?id=${id}`)}>Performance</Button>
          <Button variant="tertiary" onPress={() => router.push(`/(tabs)/more/holding-lots?id=${id}`)}>Lots</Button>
        </View>
      ) : null}
    </ScreenShell>
  );
}

export function HoldingFormScreen({ mode = "add" }: { mode?: "add" | "edit" }) {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session, workspaces } = useSession();
  const { data: accounts } = useAccounts();
  const options = accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name ?? "Account") }));
  const [name, setName] = useState("Holding");
  const [quantity, setQuantity] = useState("0");
  const [cost, setCost] = useState("0.00");
  const [price, setPrice] = useState("");
  const [maturesAt, setMaturesAt] = useState("");
  const [accountId, setAccountId] = useState("");
  const { busy, error, run } = useSubmit();
  const load = useCallback(async (workspaceId: string) => {
    if (mode !== "edit" || !id) return null;
    const data = (await session.getHolding(workspaceId, id)).data as Holding;
    setName(String(data.name ?? "Holding"));
    setAccountId(String(data.accountId ?? ""));
    setPrice(String(data.price ?? ""));
    setMaturesAt(data.maturesAt ? data.maturesAt.slice(0, 10) : "");
    return data;
  }, [id, mode, session]);
  useLiveQuery(load, null, mode === "edit" && id ? `holding-edit-${id}` : undefined);

  return (
    <ScreenShell
      title={mode === "add" ? "Add holding" : "Edit holding"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              const account = accountId || options[0]?.value;
              if (!workspaceId || !account) return;
              const mark = {
                price: price.trim() || "",
                maturesAt: maturesAt.trim() ? `${maturesAt}T00:00:00.000Z` : "",
              };
              if (mode === "add") {
                await session.createHolding(workspaceId, { name, accountId: account, quantity, cost, ...mark });
                router.replace("/(tabs)/more/investments");
              } else if (id) {
                await session.patchHolding(workspaceId, id, { name, accountId: account, ...mark });
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
      {options.length > 0 ? (
        <SegmentedControl label="Account" options={options.slice(0, 4)} value={accountId || options[0]?.value || ""} onChange={setAccountId} />
      ) : null}
      {mode === "add" ? (
        <>
          <TextField label="Quantity" value={quantity} onChangeText={setQuantity} />
          <AmountInput label="Cost" value={cost} onChange={setCost} />
        </>
      ) : null}
      <AmountInput label="Price today" value={price} onChange={setPrice} />
      <TextField label="Matures" value={maturesAt} onChangeText={setMaturesAt} helper="YYYY-MM-DD" />
    </ScreenShell>
  );
}

function TradeScreen({ kind }: { kind: "buy" | "sell" }) {
  const router = useRouter();
  const { id, data } = useHolding();
  const { session, workspaces } = useSession();
  const { data: accounts } = useAccounts();
  const options = accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name ?? "Account") }));
  const [quantityOverride, setQuantity] = useState<string | null>(null);
  const [amount, setAmount] = useState("0.00");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [accountId, setAccountId] = useState("");
  const { busy, error, run } = useSubmit();
  const quantity = quantityOverride ?? (kind === "sell" ? String(data?.quantity ?? "1") : "1");
  const capital = nairaAmount(data?.capital ?? data?.cost);
  const heldQty = Number.parseFloat(data?.quantity ?? "0") || 0;
  const qty = Number.parseFloat(quantity) || 0;
  const sliceCapital = heldQty > 0 ? (capital * Math.min(qty, heldQty)) / heldQty : 0;
  const split = splitInvestmentReturn(sliceCapital, nairaAmount(amount));
  return (
    <ScreenShell
      title={kind === "buy" ? "Place capital" : "Record return"}
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              const account = accountId || options[0]?.value;
              if (!workspaceId || !id || !account) return;
              if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) {
                throw new Error("Use a date like 2026-10-19.");
              }
              const occurredAt = `${date}T12:00:00.000Z`;
              if (kind === "buy") {
                await session.buyHolding(workspaceId, id, { fromAccountId: account, quantity, amount, occurredAt, operationId: newId() });
              } else {
                await session.sellHolding(workspaceId, id, { toAccountId: account, quantity, amount, occurredAt, operationId: newId() });
              }
              router.back();
            })
          }
        >
          Save
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <Txt>{data?.name}</Txt>
      {kind === "buy" ? (
        <Banner tone="primary" title="This is not an expense.">
          Cash leaves the account and sits as capital in the holding.
        </Banner>
      ) : (
        <Banner tone="primary" title={splitCopy(split)}>
          Ask how much came back. Extra is profit. Less than capital is a shortfall.
        </Banner>
      )}
      {options.length > 0 ? (
        <SegmentedControl label="Account" options={options.slice(0, 4)} value={accountId || options[0]?.value || ""} onChange={setAccountId} />
      ) : null}
      <TextField label="Quantity" value={quantity} onChangeText={setQuantity} />
      <AmountInput label={kind === "buy" ? "Capital" : "How much came back"} value={amount} onChange={setAmount} />
      <TextField label="Date" value={date} onChangeText={setDate} helper="YYYY-MM-DD" />
    </ScreenShell>
  );
}

export function HoldingDividendScreen() {
  const router = useRouter();
  const { id, data } = useHolding();
  const { session, workspaces } = useSession();
  const { data: accounts } = useAccounts();
  const options = accounts.filter((row) => row.id).map((row) => ({ value: String(row.id), label: String(row.name ?? "Account") }));
  const [amount, setAmount] = useState("0.00");
  const [accountId, setAccountId] = useState("");
  const { busy, error, run } = useSubmit();
  return (
    <ScreenShell
      title="Record dividend"
      footer={
        <Button
          fullWidth
          loading={busy}
          onPress={() =>
            run(async () => {
              const workspaceId = workspaces[0]?.id;
              const account = accountId || options[0]?.value;
              if (!workspaceId || !id || !account) return;
              await session.dividendHolding(workspaceId, id, { toAccountId: account, amount, operationId: newId() });
              router.back();
            })
          }
        >
          Save
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}
      <Txt>{data?.name}</Txt>
      <Banner tone="primary" title="Dividend is income.">
        Capital stays in the holding. Only this payout hits In.
      </Banner>
      {options.length > 0 ? (
        <SegmentedControl label="Account" options={options.slice(0, 4)} value={accountId || options[0]?.value || ""} onChange={setAccountId} />
      ) : null}
      <AmountInput label="Dividend" value={amount} onChange={setAmount} />
    </ScreenShell>
  );
}

export function HoldingBuyScreen() {
  return <TradeScreen kind="buy" />;
}

export function HoldingSellScreen() {
  return <TradeScreen kind="sell" />;
}

export function HoldingPerformanceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { session } = useSession();
  const [period, setPeriod] = useState("month");
  const load = useCallback(async (workspaceId: string) => {
    if (!id) return null;
    const range = dashboardBounds(period);
    return (await session.holdingPerformance(workspaceId, id, range.from, range.to)).data as { gain?: string; basis?: string };
  }, [id, period, session]);
  const { data, loading } = useLiveQuery(load, null, id ? `holding-perf-${id}-${period}` : undefined);
  return (
    <ScreenShell title="Performance">
      <SegmentedControl
        label="Period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
          { value: "year", label: "Year" },
        ]}
      />
      {loading && !data ? <DefaultLoading /> : null}
      <Amount value={nairaAmount(data?.gain)} />
      <Txt variant="caption">{data?.basis ?? "Value minus cost for lots in range."}</Txt>
    </ScreenShell>
  );
}

export function HoldingLotsScreen() {
  const t = useTheme();
  const { data, loading } = useHolding();
  return (
    <ScreenShell title="Lots">
      {loading && !data ? <DefaultLoading /> : null}
      {(data?.lots ?? []).length === 0 ? <EmptyState title="No lots yet" /> : null}
      {(data?.lots ?? []).map((lot) => (
        <View key={lot.id}>
          <Txt>{lot.at?.slice(0, 10)}</Txt>
          <Txt variant="caption" color={t.c.inkMuted}>
            Qty {lot.quantity} · {lot.cost}
          </Txt>
        </View>
      ))}
    </ScreenShell>
  );
}
