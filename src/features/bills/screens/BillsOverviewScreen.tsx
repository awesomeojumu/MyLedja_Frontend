import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, CategoryIcon, Icon, Rise, Txt, maxWidth, useTheme } from "@/design";
import {
  BillRow,
  BillsMonthGrid,
  Card,
  HeroButton,
  LeftToPay,
  MonthSwitch,
  NavyHeader,
  WeekStrip,
  whole,
} from "@/features/bills/components/BillsParts";
import { billsOverview, monthOccurrences, whenText, type ApiBill, type BillOccurrence } from "@/features/bills/services/bill-month";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";
import { useScrollTopOnFocus } from "@/lib/ui";

const EMPTY: { bills: ApiBill[]; accounts: Record<string, string> } = { bills: [], accounts: {} };

export function useBills() {
  const { session } = useSession();
  const load = useCallback(
    async (ws: string) => {
      const [bills, accounts] = await Promise.all([
        session.listBills(ws),
        session.listAccounts(ws).catch(() => ({ data: [] as { id?: string; name?: string }[] })),
      ]);
      const names: Record<string, string> = {};
      for (const a of (Array.isArray(accounts.data) ? accounts.data : []) as { id?: string; name?: string }[]) if (a.id) names[String(a.id)] = a.name ?? "";
      return { bills: (Array.isArray(bills.data) ? bills.data : []) as unknown as ApiBill[], accounts: names };
    },
    [session],
  );
  return useLiveQuery(load, EMPTY, "bills-overview");
}

function monthName(year: number, month: number, withYear = false): string {
  return new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: withYear ? "numeric" : undefined });
}

/** Bills: what's left to pay this month, overdue first, then the next 30 days. Desktop adds the month calendar. */
export function BillsOverviewScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const wide = (t.widthClass === "expanded" || t.widthClass === "large") && !t.portrait;
  const { data, loading, known, offline, error, refresh } = useBills();
  const now = new Date();
  const [showPaid, setShowPaid] = useState(false);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [picked, setPicked] = useState<string | null>(null);
  const go = (href: string) => router.push(href as never);
  const pay = (id: string) => go(`/(tabs)/plan/bill-paid?id=${encodeURIComponent(id)}`);
  const open = (id: string) => go(`/(tabs)/plan/bill-detail?id=${encodeURIComponent(id)}`);
  const back = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/plan" as never));

  const o = billsOverview(data.bills, now);
  const thisMonth = monthName(now.getFullYear(), now.getMonth());
  const empty = known && data.bills.length === 0;

  const emptyState = (
    <View style={{ alignItems: "center", gap: t.space.space3, paddingVertical: t.space.space8 }}>
      <Icon name="receipt" size={28} color={t.c.inkMuted} />
      <Txt variant="body" color={t.c.inkMuted} style={{ textAlign: "center" }}>No bills yet. Add rent, subscriptions and anything you pay on a schedule.</Txt>
      <Button size="sm" icon="plus" onPress={() => go("/(tabs)/plan/bill-add")}>Add bill</Button>
    </View>
  );

  if (wide) {
    const isCurrent = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
    const occ = monthOccurrences(data.bills, cursor.year, cursor.month, now);
    const shift = (n: number) => {
      const d = new Date(cursor.year, cursor.month + n, 1);
      setCursor({ year: d.getFullYear(), month: d.getMonth() });
      setPicked(null);
    };
    const fallback = occ.find((x) => x.status !== "paid" && x.daysAway >= 0) ?? occ.find((x) => x.status === "overdue") ?? occ[0];
    const sel: BillOccurrence | undefined = occ.find((x) => x.key === picked) ?? (picked ? undefined : fallback);
    const dayKey = sel ? `${sel.due.getFullYear()}-${sel.due.getMonth() + 1}-${sel.due.getDate()}` : "";
    const selBill = sel ? data.bills.find((b) => String(b.id) === sel.billId) : undefined;
    const monthLeft = occ.filter((x) => x.status !== "paid").reduce((s, x) => s + x.amount, 0);
    const monthPaid = occ.filter((x) => x.status === "paid").reduce((s, x) => s + x.amount, 0);
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 }}>
          <NavyHeader topInset={insets.top} wide>
            <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3, flexWrap: "wrap" }}>
              <HeroButton icon="chevron-left" label="Back" onPress={back} />
              <Txt variant="titleLg" color={t.c.onHero} accessibilityRole="header">Bills</Txt>
              <MonthSwitch label={monthName(cursor.year, cursor.month, true)} isCurrent={isCurrent} onPrev={() => shift(-1)} onNext={() => shift(1)} onToday={() => { setCursor({ year: now.getFullYear(), month: now.getMonth() }); setPicked(null); }} />
              <View style={{ flex: 1 }} />
              <Button size="sm" variant="secondary" icon="plus" onPress={() => go("/(tabs)/plan/bill-add")}>Add bill</Button>
            </View>
            <View style={{ maxWidth: 520 }}>
              <LeftToPay month={monthName(cursor.year, cursor.month)} left={monthLeft} paid={monthPaid} total={monthLeft + monthPaid} align="split" />
            </View>
          </NavyHeader>
          <View style={{ width: "100%", maxWidth: maxWidth.widthContent, alignSelf: "center", padding: t.space.space6, gap: t.space.space4 }}>
            <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
            {loading && !known ? (
              <DefaultLoading />
            ) : empty ? (
              emptyState
            ) : (
              <View style={{ flexDirection: "row", gap: t.space.space5, alignItems: "flex-start" }}>
                <View style={{ flex: 2, minWidth: 0 }}>
                  <BillsMonthGrid
                    year={cursor.year}
                    month={cursor.month}
                    occurrences={occ}
                    selected={dayKey}
                    today={now}
                    names
                    onSelect={(key) => {
                      const first = occ.find((x) => `${x.due.getFullYear()}-${x.due.getMonth() + 1}-${x.due.getDate()}` === key);
                      setPicked(first?.key ?? key);
                    }}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 280, gap: t.space.space4 }}>
                  {sel ? (
                    <Card>
                      <View style={{ padding: t.space.space4, gap: t.space.space3 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space3 }}>
                          <CategoryIcon category={sel.name} round />
                          <View style={{ flex: 1 }}>
                            <Txt variant="titleSm" accessibilityRole="header">{sel.name}</Txt>
                            <Txt variant="caption" color={sel.status === "overdue" ? t.c.danger : sel.status === "paid" ? t.c.positive : sel.daysAway <= 3 ? t.c.warning : t.c.inkMuted}>
                              {`${sel.due.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} · ${whenText(sel)}`}
                            </Txt>
                          </View>
                        </View>
                        <Txt variant="amountHero" style={{ fontSize: 26, lineHeight: 32 }}>{whole(sel.amount)}</Txt>
                        <Txt variant="caption" color={t.c.inkMuted}>
                          {[
                            sel.cadence === "weekly" ? "Weekly" : sel.cadence === "yearly" ? "Yearly" : "Monthly",
                            selBill?.accountId && data.accounts[selBill.accountId] ? `from ${data.accounts[selBill.accountId]}` : "",
                            selBill?.lastPaidAt ? `last paid ${new Date(selBill.lastPaidAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : "",
                          ].filter(Boolean).join(" · ")}
                        </Txt>
                        {sel.status !== "paid" ? <Button fullWidth onPress={() => pay(sel.billId)}>Mark paid</Button> : null}
                        <View style={{ flexDirection: "row", gap: t.space.space2 }}>
                          <View style={{ flex: 1 }}><Button fullWidth variant="secondary" onPress={() => go(`/(tabs)/plan/bill-edit?id=${encodeURIComponent(sel.billId)}`)}>Edit</Button></View>
                          <View style={{ flex: 1 }}><Button fullWidth variant="secondary" onPress={() => go(`/(tabs)/plan/bill-reminders?id=${encodeURIComponent(sel.billId)}`)}>Reminders</Button></View>
                        </View>
                      </View>
                    </Card>
                  ) : picked ? (
                    <Card>
                      <Txt variant="bodySm" color={t.c.inkMuted} style={{ padding: t.space.space4 }}>No bills on this day.</Txt>
                    </Card>
                  ) : null}
                  <Card>
                    {o.overdue.length ? (
                      <>
                        <Txt variant="caption" color={t.c.danger} style={{ fontWeight: "600", paddingHorizontal: t.space.space3, paddingTop: t.space.space3 }}>Overdue</Txt>
                        {o.overdue.map((x, i) => <BillRow key={x.key} o={x} last={i === o.overdue.length - 1} onPress={() => { setCursor({ year: x.due.getFullYear(), month: x.due.getMonth() }); setPicked(x.key); }} />)}
                      </>
                    ) : null}
                    <Txt variant="caption" color={t.c.inkMuted} style={{ fontWeight: "600", paddingHorizontal: t.space.space3, paddingTop: t.space.space3 }}>Next 30 days</Txt>
                    {o.upcoming.length ? (
                      o.upcoming.map((x, i) => (
                        <BillRow key={x.key} o={x} last={i === o.upcoming.length - 1} selected={x.key === sel?.key} onPress={() => { setCursor({ year: x.due.getFullYear(), month: x.due.getMonth() }); setPicked(x.key); }} />
                      ))
                    ) : (
                      <Txt variant="bodySm" color={t.c.inkMuted} style={{ padding: t.space.space3 }}>Nothing due in the next 30 days.</Txt>
                    )}
                  </Card>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <NavyHeader topInset={insets.top}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
            <HeroButton icon="chevron-left" label="Back" onPress={back} />
            <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Bills</Txt>
            <HeroButton icon="calendar" label="Bill calendar" onPress={() => go("/(tabs)/plan/bills-calendar")} />
            <HeroButton icon="plus" label="Add bill" onPress={() => go("/(tabs)/plan/bill-add")} />
          </View>
          <LeftToPay month={thisMonth} left={o.leftToPay} paid={o.paid} total={o.total} />
          <WeekStrip
            days={o.week}
            onPick={(date) => go(`/(tabs)/plan/bills-calendar?day=${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`)}
          />
        </NavyHeader>
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", padding: t.space.space3, gap: t.space.space3 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {loading && !known ? (
            <DefaultLoading />
          ) : empty ? (
            emptyState
          ) : (
            <Rise delay={20}>
              <View style={{ gap: t.space.space3 }}>
                {o.overdue.length ? (
                  <Card danger>
                    {o.overdue.map((x, i) => <BillRow key={x.key} o={x} last={i === o.overdue.length - 1} onPress={() => open(x.billId)} onPay={() => pay(x.billId)} />)}
                  </Card>
                ) : null}
                <Card>
                  {o.upcoming.length ? (
                    o.upcoming.map((x, i) => <BillRow key={x.key} o={x} last={i === o.upcoming.length - 1} onPress={() => open(x.billId)} onPay={x.daysAway <= 7 ? () => pay(x.billId) : undefined} />)
                  ) : (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: t.space.space4 }}>
                      <Icon name="circle-check" size={18} color={t.c.positive} />
                      <Txt variant="bodySm">Nothing due in the next 30 days.</Txt>
                    </View>
                  )}
                </Card>
                {o.paidThisMonth.length ? (
                  <>
                    <Pressable onPress={() => setShowPaid((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: showPaid }} style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: t.space.space2 }}>
                      <Txt variant="label" color={t.c.primary}>{`${o.paidThisMonth.length} paid this month`}</Txt>
                      <Icon name={showPaid ? "chevron-up" : "chevron-down"} size={14} color={t.c.primary} />
                    </Pressable>
                    {showPaid ? <Card>{o.paidThisMonth.map((x, i) => <BillRow key={x.key} o={x} last={i === o.paidThisMonth.length - 1} onPress={() => open(x.billId)} />)}</Card> : null}
                  </>
                ) : null}
              </View>
            </Rise>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
