import { useState } from "react";
import { View } from "react-native";
import { Amount, Card, LineChart, SegmentedControl, Txt, useTheme } from "@/design";
import { DashboardScreen } from "@/features/dashboard/components/DashboardScreen";
import { CASH_FLOW, cashFlowForPeriod, type CashFlowPeriod } from "@/features/dashboard/dummy-data";

const PERIODS = [
  { value: "this-month", label: "This month" },
  { value: "3-months", label: "3 months" },
  { value: "year", label: "Year" },
];

export function CashFlowScreen() {
  const t = useTheme();
  const [period, setPeriod] = useState<CashFlowPeriod>("3-months");
  const series = cashFlowForPeriod(period);
  const totalIn = series.inflow.reduce((sum, value) => sum + value, 0);
  const totalOut = series.outflow.reduce((sum, value) => sum + value, 0);
  const stacked = t.widthClass === "compact" || t.portrait;
  const chartHeight = stacked ? 200 : 240;

  return (
    <DashboardScreen title="Cash flow">
      <SegmentedControl
        label="Period"
        options={PERIODS}
        value={period}
        onChange={(value) => setPeriod(value as CashFlowPeriod)}
      />
      <Card>
        <LineChart
          title="In vs out"
          height={chartHeight}
          labels={series.labels}
          series={[
            { name: "In", values: series.inflow },
            { name: "Out", values: series.outflow },
          ]}
        />
        <View
          style={{
            flexDirection: stacked ? "column" : "row",
            gap: t.space.space4,
            paddingTop: t.space.space2,
          }}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              Total in
            </Txt>
            <Amount value={totalIn} currency={CASH_FLOW.currency} kind="income" size={stacked ? "md" : "lg"} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Txt variant="caption" color={t.c.inkMuted}>
              Total out
            </Txt>
            <Amount value={totalOut} currency={CASH_FLOW.currency} kind="expense" size={stacked ? "md" : "lg"} />
          </View>
        </View>
      </Card>
      <Card title="By period">
        {series.labels.map((label, index) => (
          <View
            key={`${label}-${index}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: t.space.space3,
              paddingVertical: t.space.space3,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: t.c.border,
            }}
          >
            <Txt variant="label" style={{ flex: 1, fontWeight: "600" }}>
              {label}
            </Txt>
            <Amount value={series.inflow[index]} currency={CASH_FLOW.currency} kind="income" size="sm" />
            <Amount value={series.outflow[index]} currency={CASH_FLOW.currency} kind="expense" size="sm" />
          </View>
        ))}
      </Card>
    </DashboardScreen>
  );
}
