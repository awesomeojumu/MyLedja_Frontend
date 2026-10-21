import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Rise, Txt, maxWidth, useTheme } from "@/design";
import { BillRow, BillsMonthGrid, Card, HeroButton, MonthSwitch, NavyHeader } from "@/features/bills/components/BillsParts";
import { useBills } from "@/features/bills/screens/BillsOverviewScreen";
import { monthOccurrences } from "@/features/bills/services/bill-month";
import { LiveNotice } from "@/lib/live-notice";
import { DefaultLoading } from "@/lib/screen-state";

/** "2026-10-23" (from the week strip) → that day; anything else → today. */
function startDay(param: string | undefined): Date {
  const m = param ? /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(param) : null;
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date();
}

/** The month as a bill calendar: each day's amount and status, and the chosen day's bills below. */
export function BillsCalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ day?: string }>();
  const { data, loading, known, offline, error, refresh } = useBills();
  const now = new Date();
  const first = startDay(params.day);
  const [cursor, setCursor] = useState({ year: first.getFullYear(), month: first.getMonth() });
  const [picked, setPicked] = useState<string | null>(params.day ? `${first.getFullYear()}-${first.getMonth() + 1}-${first.getDate()}` : null);
  const go = (href: string) => router.push(href as never);
  const isCurrent = cursor.year === now.getFullYear() && cursor.month === now.getMonth();
  const occ = monthOccurrences(data.bills, cursor.year, cursor.month, now);

  // Open on the next unpaid bill (or today in the current month), so the list below is never needlessly empty.
  const next = occ.find((o) => o.status !== "paid" && o.daysAway >= 0) ?? occ[0];
  const fallback = next ? `${next.due.getFullYear()}-${next.due.getMonth() + 1}-${next.due.getDate()}` : isCurrent ? `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}` : `${cursor.year}-${cursor.month + 1}-1`;
  const selected = picked && picked.startsWith(`${cursor.year}-${cursor.month + 1}-`) ? picked : fallback;
  const [, , d] = selected.split("-").map(Number);
  const dayBills = occ.filter((o) => o.due.getDate() === d);
  const title = new Date(cursor.year, cursor.month, d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  const shift = (n: number) => {
    const next2 = new Date(cursor.year, cursor.month + n, 1);
    setCursor({ year: next2.getFullYear(), month: next2.getMonth() });
    setPicked(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <NavyHeader topInset={insets.top}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: t.space.space2 }}>
            <HeroButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/plan/bills" as never))} />
            <Txt variant="titleMd" color={t.c.onHero} accessibilityRole="header" style={{ flex: 1 }}>Bill calendar</Txt>
            <HeroButton icon="list-filter" label="Show as a list" onPress={() => router.replace("/(tabs)/plan/bills" as never)} />
          </View>
          <MonthSwitch
            label={new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            isCurrent={isCurrent}
            onPrev={() => shift(-1)}
            onNext={() => shift(1)}
            onToday={() => {
              setCursor({ year: now.getFullYear(), month: now.getMonth() });
              setPicked(null);
            }}
          />
        </NavyHeader>
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", padding: t.space.space3, gap: t.space.space4 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {loading && !known ? (
            <DefaultLoading />
          ) : (
            <Rise delay={0}>
              <BillsMonthGrid year={cursor.year} month={cursor.month} occurrences={occ} selected={selected} today={now} onSelect={setPicked} />
            </Rise>
          )}
          {known ? (
            <View style={{ gap: t.space.space2 }}>
              <Txt variant="titleSm" accessibilityRole="header" style={{ paddingHorizontal: 4 }}>{title}</Txt>
              {dayBills.length ? (
                <Card>
                  {dayBills.map((o, i) => (
                    <BillRow
                      key={o.key}
                      o={o}
                      last={i === dayBills.length - 1}
                      onPress={() => go(`/(tabs)/plan/bill-detail?id=${encodeURIComponent(o.billId)}`)}
                      onPay={() => go(`/(tabs)/plan/bill-paid?id=${encodeURIComponent(o.billId)}`)}
                    />
                  ))}
                </Card>
              ) : (
                <Txt variant="bodySm" color={t.c.inkMuted} style={{ paddingHorizontal: 4 }}>No bills on this day.</Txt>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
