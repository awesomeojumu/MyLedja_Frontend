import { useEffect, useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, Checkbox, Footer, InlineError, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { BudgetTemplateLine, BudgetTemplateRuleKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  assignedOf,
  budgetCategories,
  budgetForMonth,
  groupedBudgetCategories,
  monthLabel,
  resolveTemplateLineAmount,
  templateLineLabel,
} from '@/features/budget/helpers';
import { catalogue, t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';

const sp = tokens.spacing;

type Kind = BudgetTemplateRuleKind | 'none';

type RowDraft = {
  categoryId: string;
  kind: Kind;
  amountText: string;
  targetMonth: string;
  billId: string;
  avgMonths: string;
  capText: string;
};

const KIND_OPTIONS: { value: Kind; labelKey: 'budget.templatesKindMonthly' | 'budget.templatesKindSaveBy' | 'budget.templatesKindCoverBill' | 'budget.templatesKindAverage' | 'budget.templatesKindCap' | 'budget.templatesKindNone' }[] = [
  { value: 'monthly', labelKey: 'budget.templatesKindMonthly' },
  { value: 'saveBy', labelKey: 'budget.templatesKindSaveBy' },
  { value: 'coverBill', labelKey: 'budget.templatesKindCoverBill' },
  { value: 'average', labelKey: 'budget.templatesKindAverage' },
  { value: 'cap', labelKey: 'budget.templatesKindCap' },
  { value: 'none', labelKey: 'budget.templatesKindNone' },
];

const WORKSPACE_TEMPLATE_NAME = 'Monthly plan';

function draftFromLine(categoryId: string, line: BudgetTemplateLine | undefined): RowDraft {
  if (!line) return { categoryId, kind: 'none', amountText: '', targetMonth: '', billId: '', avgMonths: '3', capText: '' };
  const kind = (line.ruleKind ?? 'monthly') as BudgetTemplateRuleKind;
  const meta = line.ruleMeta ?? {};
  return {
    categoryId,
    kind,
    amountText: line.amountMinor ? String(BigInt(line.amountMinor) / 100n) : meta.targetMinor ? String(BigInt(meta.targetMinor) / 100n) : '',
    targetMonth: meta.targetMonth ?? '',
    billId: meta.recurringId ?? '',
    avgMonths: meta.months ?? '3',
    capText: meta.maxMinor ? String(BigInt(meta.maxMinor) / 100n) : '',
  };
}

function buildLine(draft: RowDraft): BudgetTemplateLine | null {
  if (draft.kind === 'none') return null;
  if (draft.kind === 'monthly') {
    const parsed = draft.amountText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'monthly', amountMinor: (BigInt(parsed) * 100n).toString() };
  }
  if (draft.kind === 'saveBy') {
    const parsed = draft.amountText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed) || !/^\d{4}-\d{2}$/.test(draft.targetMonth)) return null;
    return {
      categoryId: draft.categoryId,
      ruleKind: 'saveBy',
      ruleMeta: { targetMinor: (BigInt(parsed) * 100n).toString(), targetMonth: draft.targetMonth },
    };
  }
  if (draft.kind === 'coverBill') {
    if (!draft.billId) return null;
    return { categoryId: draft.categoryId, ruleKind: 'coverBill', ruleMeta: { recurringId: draft.billId } };
  }
  if (draft.kind === 'average') {
    const n = draft.avgMonths.trim() || '3';
    if (!/^\d+$/.test(n)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'average', ruleMeta: { months: n } };
  }
  if (draft.kind === 'cap') {
    const parsed = draft.capText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'cap', ruleMeta: { maxMinor: (BigInt(parsed) * 100n).toString() } };
  }
  return null;
}

function sentenceFor(snapshot: NonNullable<ReturnType<typeof useWorkspace>['snapshot']>, draft: RowDraft): string {
  if (draft.kind === 'none') return t('budget.templatesKindNone');
  const line = buildLine(draft);
  if (!line) return t('budget.templatesIncomplete');
  return templateLineLabel(snapshot, line);
}

/** PU-09: one row per budget category with sentence templates, preview fills, total, replace tick. */
export function TemplatesSheet({
  visible,
  month,
  onClose,
}: {
  visible: boolean;
  month: string;
  onClose: () => void;
}) {
  const { snapshot, repo } = useWorkspace();
  const toast = useToast();
  const [rows, setRows] = useState<RowDraft[]>([]);
  const [replace, setReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const cats = useMemo(() => (snapshot ? budgetCategories(snapshot) : []), [snapshot]);
  const groups = useMemo(() => (snapshot ? groupedBudgetCategories(snapshot, 'groups') : []), [snapshot]);
  const bills = useMemo(() => snapshot?.recurring.filter((r) => r.kind === 'bill' || r.kind === 'subscription') ?? [], [snapshot]);

  if (!visible && loaded) setLoaded(false);

  useEffect(() => {
    if (!visible || !snapshot || loaded) return;
    const byCat = new Map<string, BudgetTemplateLine>();
    const preferred = snapshot.budgetTemplates.find((t) => t.name === WORKSPACE_TEMPLATE_NAME);
    for (const tpl of preferred ? [preferred] : snapshot.budgetTemplates) {
      for (const line of tpl.lines) byCat.set(line.categoryId, line);
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate draft rows when the sheet opens
    setRows(cats.map((c) => draftFromLine(c.id, byCat.get(c.id))));
    setReplace(false);
    setError(null);
    setLoaded(true);
  }, [visible, snapshot, cats, loaded]);

  const previews = useMemo(() => {
    if (!snapshot) return [] as { categoryId: string; fill: bigint; keep: boolean }[];
    return rows.map((row) => {
      const line = buildLine(row);
      const fill = line ? resolveTemplateLineAmount(snapshot, month, line) : 0n;
      const existing = assignedOf(snapshot, row.categoryId, month);
      const keep = !replace && existing > 0n;
      return { categoryId: row.categoryId, fill: keep ? existing : fill, keep };
    });
  }, [snapshot, rows, month, replace]);

  const plannedTotal = previews.reduce((s, p) => s + p.fill, 0n);
  const available = useMemo(() => {
    if (!snapshot) return 0n;
    return budgetForMonth(snapshot, month).leftToPlan + plannedTotal;
  }, [snapshot, month, plannedTotal]);

  const groupLabel = (group: string): string => {
    if (group in catalogue) return t(group as TextKey);
    return group;
  };

  const updateRow = (categoryId: string, patch: Partial<RowDraft>) => {
    setRows((all) => all.map((r) => (r.categoryId === categoryId ? { ...r, ...patch } : r)));
  };

  const collectLines = (): BudgetTemplateLine[] => {
    const out: BudgetTemplateLine[] = [];
    for (const row of rows) {
      const line = buildLine(row);
      if (line) out.push(line);
    }
    return out;
  };

  const saveTemplates = async () => {
    if (!snapshot) return;
    setBusy(true);
    setError(null);
    try {
      const lines = collectLines();
      const existing = snapshot.budgetTemplates.find((t) => t.name === WORKSPACE_TEMPLATE_NAME);
      if (existing) {
        await repo.saveBudgetTemplate(WORKSPACE_TEMPLATE_NAME, lines);
      } else {
        await repo.saveBudgetTemplate(WORKSPACE_TEMPLATE_NAME, lines);
      }
      toast.show(t('budget.templatesSaved'));
    } catch {
      setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!snapshot) return;
    setBusy(true);
    setError(null);
    try {
      const lines = collectLines();
      const saved = await repo.saveBudgetTemplate(WORKSPACE_TEMPLATE_NAME, lines);
      const before = new Map(cats.map((c) => [c.id, assignedOf(snapshot, c.id, month)]));
      await repo.applyBudgetTemplate(saved.id, month, { replace });
      toast.show(t('budget.templatesApplied'), async () => {
        for (const [categoryId, amount] of before) {
          await repo.setAssigned(categoryId, month, amount);
        }
      });
      onClose();
    } catch {
      setError(t('errors.network'));
    } finally {
      setBusy(false);
    }
  };

  if (!snapshot) return null;

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('budget.templatesTitle')}
      testID="budget-templates-sheet"
      width={720}
      footer={
        <Footer>
          <Button kind="secondary" label={t('common.cancel')} onPress={onClose} />
          <Button testID="budget-templates-apply" label={t('budget.templatesApplyMonth', { month: monthLabel(month) })} disabled={busy} onPress={() => void apply()} />
        </Footer>
      }
    >
      <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
        {error ? <InlineError message={error} /> : null}
        {groups.map(([groupKey, groupCats]) => (
          <View key={groupKey} style={{ gap: sp['spacing-sm'] }} testID={`budget-templates-group-${groupKey}`}>
            <Text variant="heading-sm">{groupLabel(groupKey)}</Text>
            {groupCats.map((cat) => {
              const row = rows.find((r) => r.categoryId === cat.id) ?? draftFromLine(cat.id, undefined);
              const preview = previews.find((p) => p.categoryId === cat.id);
              return (
                <Card key={cat.id} style={{ gap: sp['spacing-xs'] }} testID={`budget-templates-row-${cat.id}`}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'], alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="heading-sm">{cat.name}</Text>
                      <Text tone="textSecondary" testID={`budget-templates-sentence-${cat.id}`}>
                        {sentenceFor(snapshot, row)}
                      </Text>
                    </View>
                    <Text testID={`budget-templates-fill-${cat.id}`}>{formatNaira(preview?.fill ?? 0n)}</Text>
                  </View>
                  <Select
                    testID={`budget-templates-kind-${cat.id}`}
                    label={t('budget.templatesRuleKind')}
                    value={row.kind}
                    onChange={(v) => updateRow(cat.id, { kind: v as Kind })}
                    options={KIND_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
                  />
                  {row.kind === 'monthly' || row.kind === 'saveBy' ? (
                    <TextInput
                      label={row.kind === 'saveBy' ? t('budget.templatesTargetAmount') : t('budget.templatesAmount')}
                      value={row.amountText}
                      onChangeText={(text) => updateRow(cat.id, { amountText: text })}
                      keyboardType="number-pad"
                    />
                  ) : null}
                  {row.kind === 'saveBy' ? (
                    <TextInput
                      label={t('budget.templatesTargetMonth')}
                      value={row.targetMonth}
                      onChangeText={(text) => updateRow(cat.id, { targetMonth: text })}
                      placeholder="2027-12"
                    />
                  ) : null}
                  {row.kind === 'coverBill' ? (
                    <Select
                      label={t('budget.templatesBill')}
                      value={row.billId}
                      onChange={(id) => updateRow(cat.id, { billId: id })}
                      options={bills.map((b) => ({ value: b.id, label: b.name }))}
                    />
                  ) : null}
                  {row.kind === 'average' ? (
                    <TextInput
                      label={t('budget.templatesAvgMonths')}
                      value={row.avgMonths}
                      onChangeText={(text) => updateRow(cat.id, { avgMonths: text })}
                      keyboardType="number-pad"
                    />
                  ) : null}
                  {row.kind === 'cap' ? (
                    <TextInput
                      label={t('budget.templatesCap')}
                      value={row.capText}
                      onChangeText={(text) => updateRow(cat.id, { capText: text })}
                      keyboardType="number-pad"
                    />
                  ) : null}
                </Card>
              );
            })}
          </View>
        ))}
        <Text testID="budget-templates-total" tone="textSecondary">
          {t('budget.templatesTotal', { planned: formatNaira(plannedTotal), available: formatNaira(available) })}
        </Text>
        <Checkbox
          testID="budget-templates-replace"
          label={t('budget.templatesReplace')}
          checked={replace}
          onChange={setReplace}
        />
        <Button testID="budget-templates-save" kind="link" label={t('budget.templatesSave')} disabled={busy} onPress={() => void saveTemplates()} />
      </ScrollView>
    </Sheet>
  );
}
