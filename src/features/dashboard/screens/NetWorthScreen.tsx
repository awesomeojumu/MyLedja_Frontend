import { useState } from "react";
import { View } from "react-native";
import { Amount, Card, HeroBalance, LineChart, SectionHeader, Txt, useTheme } from "../../../design";
import { DashboardScreen } from "../components/DashboardScreen";
import { NET_WORTH } from "../dummy-data";

export function NetWorthScreen() {
  const t = useTheme();
  const [hidden, setHidden] = useState(false);
  const chartHeight = t.widthClass === "compact" || t.portrait ? 200 : 240;

  return (
    <DashboardScreen title="Net worth">
      <HeroBalance
        label="Net worth"
        value={NET_WORTH.total}
        currency={NET_WORTH.currency}
        hidden={hidden}
        onToggleHidden={() => setHidden((prev) => !prev)}
      />
      <Card>
        <LineChart
          title="Net worth over time"
          height={chartHeight}
          labels={NET_WORTH.history.map((point) => point.label)}
          series={[{ name: "Net worth", values: NET_WORTH.history.map((point) => point.value) }]}
        />
      </Card>
      <SectionHeader title="Assets" />
      <Card flat>
        {NET_WORTH.assets.map((row, index) => (
          <View
            key={row.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: t.space.space3,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: t.c.border,
            }}
          >
            <Txt variant="label" style={{ flex: 1, fontWeight: "600" }}>
              {row.name}
            </Txt>
            <Amount value={row.amount} currency={NET_WORTH.currency} hidden={hidden} />
          </View>
        ))}
      </Card>
      <SectionHeader title="Liabilities" />
      <Card flat>
        {NET_WORTH.liabilities.map((row, index) => (
          <View
            key={row.name}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: t.space.space3,
              borderTopWidth: index === 0 ? 0 : 1,
              borderTopColor: t.c.border,
            }}
          >
            <Txt variant="label" style={{ flex: 1, fontWeight: "600" }}>
              {row.name}
            </Txt>
            <Amount value={row.amount} currency={NET_WORTH.currency} kind="expense" hidden={hidden} />
          </View>
        ))}
      </Card>
    </DashboardScreen>
  );
}
