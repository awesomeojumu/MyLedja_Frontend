import { useCallback, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, Rise, Txt, formatMoney, maxWidth, useTheme } from "@/design";
import { useDashboardOverlays } from "@/features/dashboard";
import { CalendarGrid, CalendarHeader } from "@/features/transactions/components/TxCalendarParts";
import {
  calendarMonth,
  defaultCalendarDay,
  groupByDay,
  monthIndex,
  monthLabel,
  onDay,
} from "@/features/transactions/services/tx-feed";
import { LiveNotice } from "@/lib/live-notice";
import { toLedgerAccount, type ApiAccount, type ApiTransaction } from "@/lib/money-map";
import { DefaultLoading } from "@/lib/screen-state";
import { LedgerRow, useScrollTopOnFocus } from "@/lib/ui";
import { useLiveQuery } from "@/lib/use-live-query";
import { useSession } from "@/state";

const EMPTY = { txns: [] as ApiTransaction[], names: {} as Record<string, string>, categories: {} as Record<string, string> };
/** The calendar starts weeks on Monday, the common Nigerian convention. */
const WEEK_STARTS_ON = "monday" as const;

function dateOf(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function CalendarScreen() {
  const t = useTheme();
  const scrollTop = useScrollTopOnFocus();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useSession();
  const { requestAdd } = useDashboardOverlays();
  const params = useLocalSearchParams<{ month?: string }>();
  const thisMonth = monthIndex(new Date());
  const asked = Number(params.month);
  const [month, setMonth] = useState(Number.isFinite(asked) && asked > 0 && asked <= thisMonth ? asked : thisMonth);
  const [picked, setPicked] = useState<string | null>(null);

  const load = useCallback(
    async (workspaceId: string) => {
      const [txRes, accountsRes, categoriesRes] = await Promise.all([
        session.listTransactions(workspaceId),
        session.listAccounts(workspaceId),
        session.listCategories(workspaceId).catch(() => ({ data: [] as { id: string; name: string }[] })),
      ]);
      const names = Object.fromEntries(
        (Array.isArray(accountsRes.data) ? accountsRes.data : []).map((row) => {
          const account = toLedgerAccount(row as ApiAccount);
          return [account.id, account.name] as const;
        }),
      ) as Record<string, string>;
      const categories = Object.fromEntries(
        (Array.isArray(categoriesRes.data) ? categoriesRes.data : []).map((row) => [String(row.id), row.name] as const),
      ) as Record<string, string>;
      return { txns: (txRes.data?.transactions ?? []).filter((row) => row.id), names, categories };
    },
    [session],
  );

  // Same cache as the Transactions list, so opening the calendar from there is instant.
  const { data, loading, offline, error, known, refresh } = useLiveQuery(load, EMPTY, "transactions-feed");
  const txns = data?.txns ?? [];
  const names = data?.names ?? EMPTY.names;
  const categories = data?.categories ?? EMPTY.categories;

  const cal = calendarMonth(txns, month, WEEK_STARTS_ON);
  const inThisMonth = picked != null && cal.days.some((d) => d.key === picked);
  const selected = inThisMonth ? picked : defaultCalendarDay(cal);
  const selectedDay = cal.days.find((d) => d.key === selected);
  const date = dateOf(selected);
  const items = groupByDay(onDay(txns, selected), categories, names)[0]?.items ?? [];
  const net = (selectedDay?.income ?? 0) - (selectedDay?.spent ?? 0);
  const biggestLabel = cal.biggest ? dateOf(cal.biggest.key).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" }) : "None yet";

  const changeMonth = (next: number) => {
    if (next > thisMonth) return;
    setMonth(next);
    setPicked(null);
  };

  const dayTitle = date.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const shortDate = date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const dayMeta =
    items.length === 0
      ? ""
      : `${items.length} ${items.length === 1 ? "entry" : "entries"}${net === 0 ? "" : ` · ${net > 0 ? "+" : "−"}${formatMoney(Math.abs(net))}`}`;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView ref={scrollTop} contentContainerStyle={{ paddingBottom: t.space.space12 + t.space.space8 }}>
        <CalendarHeader
          topInset={insets.top}
          month={monthLabel(month)}
          isCurrentMonth={month === thisMonth}
          cal={known ? cal : null}
          biggestLabel={biggestLabel}
          onBack={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/transactions"))}
          onList={() => router.replace("/(tabs)/transactions")}
          onPrev={() => changeMonth(month - 1)}
          onNext={() => changeMonth(month + 1)}
          onThisMonth={() => changeMonth(thisMonth)}
        />
        <View style={{ width: "100%", maxWidth: maxWidth.widthReading, alignSelf: "center", paddingHorizontal: t.space.space3, paddingTop: t.space.space4, gap: t.space.space5 }}>
          <LiveNotice offline={offline} error={error} hasData={known} onRetry={refresh} />
          {loading && !known ? (
            <DefaultLoading />
          ) : (
            <Rise delay={0}>
              <CalendarGrid
                cal={cal}
                weekStartsOn={WEEK_STARTS_ON}
                selected={selected}
                onSelect={setPicked}
                onSwipePrev={() => changeMonth(month - 1)}
                onSwipeNext={() => changeMonth(month + 1)}
              />
            </Rise>
          )}

          {known ? (
            <View style={{ gap: t.space.space2 }}>
              <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: t.space.space2, paddingHorizontal: 4 }}>
                <Txt variant="titleSm" accessibilityRole="header">{dayTitle}</Txt>
                {dayMeta ? <Txt variant="caption" color={t.c.inkMuted}>{dayMeta}</Txt> : null}
              </View>
              {items.length > 0 ? (
                <View style={{ borderRadius: t.radius.radiusLg, backgroundColor: t.c.surface, borderWidth: 1, borderColor: t.c.border, overflow: "hidden" }}>
                  {items.map((item, i) => (
                    <LedgerRow
                      key={item.id}
                      item={item}
                      compact
                      last={i === items.length - 1}
                      onPress={() => router.push(`/(tabs)/transactions/${item.id}`)}
                      onAddCategory={() => router.push(`/(tabs)/transactions/edit?id=${encodeURIComponent(item.id)}`)}
                    />
                  ))}
                </View>
              ) : (
                <Txt variant="body" color={t.c.inkMuted} style={{ paddingHorizontal: 4 }}>
                  {selectedDay?.future ? "This day hasn't happened yet." : `Nothing recorded on ${date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}.`}
                </Txt>
              )}
              {selectedDay && !selectedDay.future ? (
                <Pressable
                  onPress={() => requestAdd("expense", selected)}
                  accessibilityRole="button"
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: t.space.space3 }}
                >
                  <Icon name="plus" size={16} color={t.c.primary} />
                  <Txt variant="label" color={t.c.primary}>{selectedDay.today ? "Add an entry today" : `Add an entry on ${shortDate}`}</Txt>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}
