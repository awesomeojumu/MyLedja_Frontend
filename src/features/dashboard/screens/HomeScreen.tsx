import { useRouter } from "expo-router";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Banner,
  BudgetTile,
  EmptyState,
  formatMoney,
  HeroBalance,
  IconButton,
  maxWidth,
  Rise,
  SectionHeader,
  SegmentedControl,
  StatTile,
  SummaryCard,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { twoColumn } from "@/lib";
import { HOME_DUMMY } from "@/features/dashboard/dummy-data";
import { useDashboardOverlays } from "@/features/dashboard/overlay-context";

const PERIODS = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

export function HomeScreen({ onMore }: { onMore?: () => void } = {}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { openQuickAdd, openSearch } = useDashboardOverlays();
  const [hidden, setHidden] = useState(false);
  const [period, setPeriod] = useState("month");
  const columns = twoColumn(t.widthClass, t.portrait);
  const month = period === "month";

  const hero = (
    <Rise delay={0}>
      <HeroBalance
        value={HOME_DUMMY.balance}
        currency={HOME_DUMMY.currency}
        freshness={HOME_DUMMY.freshness}
        hidden={hidden}
        onToggleHidden={() => setHidden((prev) => !prev)}
        actions={HOME_DUMMY.heroActions.map((action) => ({
          ...action,
          onPress: openQuickAdd,
        }))}
      />
    </Rise>
  );

  const stats = (
    <Rise delay={40}>
      <View style={{ flexDirection: "row", gap: t.space.space3 }}>
        <StatTile label="Spent" value={HOME_DUMMY.spent} kind="spent" icon="arrow-down-left" hidden={hidden} />
        <StatTile label="In" value={HOME_DUMMY.income} kind="income" icon="arrow-up-right" hidden={hidden} />
      </View>
    </Rise>
  );

  const summary = (
    <Rise delay={80}>
      <View style={{ gap: t.space.space3 }}>
        <SegmentedControl label="Period" options={PERIODS} value={period} onChange={setPeriod} />
        {month ? (
          <SummaryCard
            label="Spent this month"
            value={HOME_DUMMY.spent}
            kind="expense"
            delta={-4.2}
            goodWhenUp={false}
            hidden={hidden}
            freshness={HOME_DUMMY.freshness}
          />
        ) : (
          <EmptyState title="Nothing recorded for this period" icon="calendar">
            Switch back to Month to see the dummy naira figures.
          </EmptyState>
        )}
      </View>
    </Rise>
  );

  const upcoming = (
    <Rise delay={100}>
      <View style={{ gap: t.space.space3 }}>
        <SectionHeader title="Coming up" action={{ label: "See all", onPress: () => router.push("/(tabs)/upcoming") }} />
        <Banner tone="warning" title="Rent is due in 3 days" icon="calendar">
          {formatMoney(250000, HOME_DUMMY.currency)} from GTBank.
        </Banner>
      </View>
    </Rise>
  );

  const budgets = (
    <Rise delay={120}>
      <View style={{ gap: t.space.space3 }}>
        <SectionHeader title="Budgets" meta="Dummy naira" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: t.space.space3 }}>
          {HOME_DUMMY.budgets.map((budget) => (
            <BudgetTile
              key={budget.category}
              category={budget.category}
              value={budget.value}
              max={budget.max}
              currency={HOME_DUMMY.currency}
            />
          ))}
        </ScrollView>
      </View>
    </Rise>
  );

  const recent = (
    <Rise delay={160}>
      <View style={{ gap: t.space.space3 }}>
        <SectionHeader title="Recent" action={{ label: "See all", onPress: () => router.push("/(tabs)/cash-flow") }} />
        <View style={{ borderRadius: t.radius.radiusLg, overflow: "hidden", borderWidth: 1, borderColor: t.c.borderStrong }}>
          {HOME_DUMMY.recent.map((row) => (
            <TransactionRow
              key={`${row.title}-${row.time}`}
              title={row.title}
              category={row.category}
              account={row.account}
              amount={row.amount}
              kind={row.kind}
              time={row.time}
              status={row.status}
              hidden={hidden}
            />
          ))}
        </View>
      </View>
    </Rise>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + t.space.space4,
          paddingHorizontal: t.space.space4,
          paddingBottom: t.space.space12,
          gap: t.space.space5,
          maxWidth: maxWidth.widthContent,
          width: "100%",
          alignSelf: "center",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Txt variant="titleMd" accessibilityRole="header">
            Home
          </Txt>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <IconButton icon="search" label="Search" onPress={openSearch} />
            {onMore ? <IconButton icon="ellipsis" label="More" onPress={onMore} /> : null}
          </View>
        </View>
        {columns ? (
          <View style={{ flexDirection: "row", gap: t.space.space6, alignItems: "flex-start" }}>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              {hero}
              {month ? stats : null}
              {summary}
              {upcoming}
            </View>
            <View style={{ flex: 1, gap: t.space.space5 }}>
              {budgets}
              {recent}
            </View>
          </View>
        ) : (
          <>
            {hero}
            {month ? stats : null}
            {summary}
            {upcoming}
            {budgets}
            {recent}
          </>
        )}
      </ScrollView>
    </View>
  );
}
