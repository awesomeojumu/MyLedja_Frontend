import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  Banner,
  Button,
  Card,
  CategoryPicker,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";

const UNMAPPED_SAMPLE = [
  { rawName: "POS PURCHASE WES", occurrences: 14, defaultGuess: "Food & groceries" },
  { rawName: "TRF/UBAPAY/QUICK", occurrences: 6, defaultGuess: "Bank charges" },
  { rawName: "AIRTIME E-TOPUP", occurrences: 9, defaultGuess: "Data & airtime" },
];

export function ImportCategoryMappingScreen() {
  const t = useTheme();
  const router = useRouter();

  const [mappings, setMappings] = useState<Record<string, string>>({
    "POS PURCHASE WES": "Food & groceries",
    "TRF/UBAPAY/QUICK": "Bank charges",
    "AIRTIME E-TOPUP": "Data & airtime",
  });

  const { busy, error, run } = useSubmit();

  const handleSave = () => {
    run(async () => {
      router.back();
    });
  };

  return (
    <PageScaffold
      title="Import category mapping"
      footer={
        <Button fullWidth loading={busy} onPress={handleSave}>
          Confirm mappings
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}

      <Txt variant="body" color={t.c.inkMuted}>
        Match category names detected in your imported statement files to MyLedja categories.
        Mappings will be remembered for future statements.
      </Txt>

      <View style={{ gap: t.space.space3 }}>
        {UNMAPPED_SAMPLE.map((item) => (
          <Card key={item.rawName}>
            <View style={{ gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Txt variant="label" style={{ fontWeight: "700" }}>
                  {item.rawName}
                </Txt>
                <Txt variant="caption" color={t.c.inkMuted}>
                  {item.occurrences} rows
                </Txt>
              </View>

              <CategoryPicker
                label="Maps to"
                value={mappings[item.rawName] ?? item.defaultGuess}
                onChange={(cat) =>
                  setMappings((prev) => ({ ...prev, [item.rawName]: cat }))
                }
              />
            </View>
          </Card>
        ))}
      </View>
    </PageScaffold>
  );
}
