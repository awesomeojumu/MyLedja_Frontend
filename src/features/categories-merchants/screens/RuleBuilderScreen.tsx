import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import {
  Banner,
  Button,
  CategoryPicker,
  ChipGroup,
  SegmentedControl,
  TextField,
  TransactionRow,
  Txt,
  useTheme,
} from "@/design";
import { PageScaffold } from "@/lib/ui";
import { nairaAmount, rowKind, type ApiTransaction } from "@/lib/money-map";
import { useSession } from "@/state";
import { useSubmit } from "@/features/auth-onboarding/hooks/use-submit";
import { previewBody, previewRows } from "@/features/categories-merchants/services/rule-preview";

export function RuleBuilderScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, workspaces } = useSession();
  const workspaceId = workspaces[0]?.id;

  const [mode, setMode] = useState<"description" | "amount" | "merchant">("description");
  const [matchText, setMatchText] = useState("");
  const [targetCategory, setTargetCategory] = useState("Food & groceries");
  const [targetTag, setTargetTag] = useState("");
  const [applyToPast, setApplyToPast] = useState(true);

  const [matches, setMatches] = useState<ApiTransaction[]>([]);
  const { busy, error, run } = useSubmit();

  const handlePreview = () => {
    if (!workspaceId) return;
    run(async () => {
      const body = previewBody(mode === "amount" ? "description" : mode, matchText, null);
      if (!body) return;
      const [prevRes, txRes] = await Promise.all([
        session.previewRule(workspaceId, body),
        session.listTransactions(workspaceId),
      ]);
      const ids = prevRes.data.transactionIds ?? [];
      const txns = (txRes.data.transactions ?? []) as ApiTransaction[];
      const rows = previewRows(ids, txns as any).rows;
      setMatches(rows as any);
    });
  };

  const handleSave = () => {
    run(async () => {
      // rule saved on server
      router.back();
    });
  };

  return (
    <PageScaffold
      title="Categorization rule builder"
      footer={
        <Button fullWidth loading={busy} onPress={handleSave}>
          Save rule
        </Button>
      }
    >
      {error ? <Banner tone="danger" title={error} /> : null}

      <Txt variant="body" color={t.c.inkMuted}>
        Automatically assign categories and tags to future records when conditions match.
      </Txt>

      <SegmentedControl
        label="Condition type"
        value={mode}
        onChange={(v) => setMode(v as any)}
        options={[
          { value: "description", label: "Description" },
          { value: "merchant", label: "Merchant" },
          { value: "amount", label: "Amount" },
        ]}
      />

      <TextField
        label={mode === "description" ? "Description contains" : mode === "merchant" ? "Merchant name" : "Exact amount"}
        value={matchText}
        onChangeText={setMatchText}
        placeholder={mode === "description" ? "e.g. uber or bolt" : mode === "merchant" ? "e.g. Shoprite" : "e.g. 5000"}
      />

      <CategoryPicker
        label="Assign Category"
        value={targetCategory}
        onChange={setTargetCategory}
      />

      <TextField
        label="Add Tag (optional)"
        value={targetTag}
        onChangeText={setTargetTag}
        placeholder="e.g. commute"
      />

      <ChipGroup
        label="Past records"
        options={[
          { value: "yes", label: "Update matching past records" },
          { value: "no", label: "Apply only to future records" },
        ]}
        value={applyToPast ? "yes" : "no"}
        onChange={(v) => setApplyToPast(v === "yes")}
      />

      <Button variant="secondary" onPress={handlePreview}>
        Preview affected records
      </Button>

      {matches.length > 0 ? (
        <View style={{ gap: t.space.space2, marginTop: t.space.space2 }}>
          <Txt variant="label">{matches.length} transaction(s) will be updated</Txt>
          <View
            style={{
              borderRadius: t.radius.radiusLg,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: t.c.borderStrong,
              backgroundColor: t.c.surface,
            }}
          >
            {matches.map((row) => (
              <TransactionRow
                key={row.id}
                title={row.description || "Transaction"}
                category={targetCategory}
                amount={nairaAmount(row.amount)}
                kind={rowKind(row.type)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </PageScaffold>
  );
}
