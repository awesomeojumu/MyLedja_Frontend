import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Banner, Button, Card, Select, Txt, useTheme } from "../../../design";
import { AccountScreenShell } from "../components/AccountScreenShell";
import { COLUMN_OPTIONS, STATEMENT_COLUMNS } from "../dummy-data";

export function MatchColumnsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [mapped, setMapped] = useState(() => STATEMENT_COLUMNS.map((column) => column.mapped));

  const setAt = (index: number, value: string) => {
    setMapped((current) => current.map((item, i) => (i === index ? value : item)));
  };

  return (
    <AccountScreenShell
      title="Match columns"
      emptyTitle="No columns to match"
      errorTitle="Could not read this statement"
      footer={
        <Button fullWidth onPress={() => router.push(`/(tabs)/accounts/import-preview?id=${id ?? "gtbank"}`)}>
          Preview import
        </Button>
      }
    >
      <Banner tone="primary" title="Date, description, amount">
        Skip extra columns like running balance.
      </Banner>
      {STATEMENT_COLUMNS.map((column, index) => (
        <Card key={column.header}>
          <View style={{ gap: t.space.space3 }}>
            <Txt variant="titleSm">{column.header}</Txt>
            <Txt variant="caption" color={t.c.inkMuted}>
              Sample · {column.sample}
            </Txt>
            <Select label="Maps to" options={COLUMN_OPTIONS} value={mapped[index]} onChange={(value) => setAt(index, value)} />
          </View>
        </Card>
      ))}
    </AccountScreenShell>
  );
}
