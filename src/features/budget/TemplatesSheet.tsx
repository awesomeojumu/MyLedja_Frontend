import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, InlineError, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import type { BudgetTemplateLine, BudgetTemplateRuleKind } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import {
  budgetCategories,
  monthLabel,
  resolveTemplateLineAmount,
  templateLineLabel,
} from '@/features/budget/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

const sp = tokens.spacing;

type LineDraft = {
  categoryId: string;
  ruleKind: BudgetTemplateRuleKind;
  amountText: string;
  targetMonth: string;
  billId: string;
  avgMonths: string;
  capText: string;
};

const RULE_OPTIONS: { value: BudgetTemplateRuleKind; labelKey: 'budget.templatesKindMonthly' | 'budget.templatesKindSaveBy' | 'budget.templatesKindCoverBill' | 'budget.templatesKindAverage' | 'budget.templatesKindCap' }[] = [
  { value: 'monthly', labelKey: 'budget.templatesKindMonthly' },
  { value: 'saveBy', labelKey: 'budget.templatesKindSaveBy' },
  { value: 'coverBill', labelKey: 'budget.templatesKindCoverBill' },
  { value: 'average', labelKey: 'budget.templatesKindAverage' },
  { value: 'cap', labelKey: 'budget.templatesKindCap' },
];

function emptyLine(): LineDraft {
  return { categoryId: '', ruleKind: 'monthly', amountText: '', targetMonth: '', billId: '', avgMonths: '3', capText: '' };
}

function buildLine(draft: LineDraft): BudgetTemplateLine | null {
  if (!draft.categoryId) return null;
  if (draft.ruleKind === 'monthly') {
    const parsed = draft.amountText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'monthly', amountMinor: (BigInt(parsed) * 100n).toString() };
  }
  if (draft.ruleKind === 'saveBy') {
    const parsed = draft.amountText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed) || !/^\d{4}-\d{2}$/.test(draft.targetMonth)) return null;
    return {
      categoryId: draft.categoryId,
      ruleKind: 'saveBy',
      ruleMeta: { targetMinor: (BigInt(parsed) * 100n).toString(), targetMonth: draft.targetMonth },
    };
  }
  if (draft.ruleKind === 'coverBill') {
    if (!draft.billId) return null;
    return { categoryId: draft.categoryId, ruleKind: 'coverBill', ruleMeta: { recurringId: draft.billId } };
  }
  if (draft.ruleKind === 'average') {
    const n = draft.avgMonths.trim() || '3';
    if (!/^\d+$/.test(n)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'average', ruleMeta: { months: n } };
  }
  if (draft.ruleKind === 'cap') {
    const parsed = draft.capText.replace(/,/g, '').trim();
    if (!/^\d+$/.test(parsed)) return null;
    return { categoryId: draft.categoryId, ruleKind: 'cap', ruleMeta: { maxMinor: (BigInt(parsed) * 100n).toString() } };
  }
  return null;
}

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
  const [name, setName] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cats = useMemo(() => (snapshot ? budgetCategories(snapshot) : []), [snapshot]);
  const bills = useMemo(() => snapshot?.recurring.filter((r) => r.kind === 'bill' || r.kind === 'subscription') ?? [], [snapshot]);

  const selectedRows = useMemo(() => {
    if (!snapshot || !selectedId) return [];
    const template = snapshot.budgetTemplates.find((t) => t.id === selectedId);
    if (!template) return [];
    return template.lines.map((line) => {
      const catName = snapshot.categories.find((c) => c.id === line.categoryId)?.name ?? '';
      const fill = resolveTemplateLineAmount(snapshot, month, line);
      return { id: line.categoryId + catName, catName, rule: templateLineLabel(snapshot, line), fill };
    });
  }, [snapshot, selectedId, month]);

  const saveTemplate = async () => {
    if (!snapshot) return;
    const built = lines.map(buildLine).filter((x): x is BudgetTemplateLine => x !== null);
    if (!name.trim() || built.length === 0) {
      setError(t('budget.templatesMissing'));
      return;
    }
    const saved = await repo.saveBudgetTemplate(name.trim(), built);
    setSelectedId(saved.id);
    setError(null);
    toast.show(t('common.saved'));
  };

  const apply = async () => {
    if (!selectedId) return;
    await repo.applyBudgetTemplate(selectedId, month);
    toast.show(t('common.saved'));
    onClose();
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
        <Button
          testID="budget-templates-apply"
          label={t('budget.templatesApplyMonth', { month: monthLabel(month) })}
          onPress={apply}
          disabled={!selectedId}
        />
      }
    >
      <ScrollView contentContainerStyle={{ gap: sp['spacing-md'] }}>
        {error ? <InlineError message={error} /> : null}
        {snapshot.budgetTemplates.length > 0 ? (
          <Select
            testID="budget-templates-pick"
            label={t('budget.templatesPick')}
            value={selectedId ?? ''}
            onChange={(id) => setSelectedId(id || null)}
            options={snapshot.budgetTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
          />
        ) : (
          <Text tone="textSecondary">{t('budget.templatesEmpty')}</Text>
        )}
        {selectedRows.length > 0 ? (
          <Card testID="budget-templates-preview" style={{ gap: sp['spacing-sm'] }}>
            <Text variant="heading-sm">{t('budget.templatesPreview')}</Text>
            {selectedRows.map((row) => (
              <View key={row.id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'], alignItems: 'flex-start' }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="caption" tone="textSecondary">
                    {row.catName}
                  </Text>
                  <Text>{row.rule}</Text>
                </View>
                <Text testID={`budget-templates-fill-${row.id}`}>{formatNaira(row.fill)}</Text>
              </View>
            ))}
          </Card>
        ) : null}
        <Text variant="heading-sm">{t('budget.templatesNew')}</Text>
        <TextInput testID="budget-templates-name" label={t('budget.templatesName')} value={name} onChangeText={setName} />
        {lines.map((line, i) => (
          <Card key={i} style={{ gap: sp['spacing-xs'] }}>
            <Select
              label={t('budget.templatesCategory')}
              value={line.categoryId}
              onChange={(id) => setLines((all) => all.map((row, j) => (j === i ? { ...row, categoryId: id } : row)))}
              options={cats.map((c) => ({ value: c.id, label: c.name }))}
            />
            <Select
              label={t('budget.templatesRuleKind')}
              value={line.ruleKind}
              onChange={(v) => setLines((all) => all.map((row, j) => (j === i ? { ...row, ruleKind: v as BudgetTemplateRuleKind } : row)))}
              options={RULE_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            />
            {line.ruleKind === 'monthly' || line.ruleKind === 'saveBy' ? (
              <TextInput
                label={line.ruleKind === 'saveBy' ? t('budget.templatesTargetAmount') : t('budget.templatesAmount')}
                value={line.amountText}
                onChangeText={(text) => setLines((all) => all.map((row, j) => (j === i ? { ...row, amountText: text } : row)))}
                keyboardType="number-pad"
              />
            ) : null}
            {line.ruleKind === 'saveBy' ? (
              <TextInput
                label={t('budget.templatesTargetMonth')}
                value={line.targetMonth}
                onChangeText={(text) => setLines((all) => all.map((row, j) => (j === i ? { ...row, targetMonth: text } : row)))}
                placeholder="2027-12"
              />
            ) : null}
            {line.ruleKind === 'coverBill' ? (
              <Select
                label={t('budget.templatesBill')}
                value={line.billId}
                onChange={(id) => setLines((all) => all.map((row, j) => (j === i ? { ...row, billId: id } : row)))}
                options={bills.map((b) => ({ value: b.id, label: b.name }))}
              />
            ) : null}
            {line.ruleKind === 'average' ? (
              <TextInput
                label={t('budget.templatesAvgMonths')}
                value={line.avgMonths}
                onChangeText={(text) => setLines((all) => all.map((row, j) => (j === i ? { ...row, avgMonths: text } : row)))}
                keyboardType="number-pad"
              />
            ) : null}
            {line.ruleKind === 'cap' ? (
              <TextInput
                label={t('budget.templatesCap')}
                value={line.capText}
                onChangeText={(text) => setLines((all) => all.map((row, j) => (j === i ? { ...row, capText: text } : row)))}
                keyboardType="number-pad"
              />
            ) : null}
          </Card>
        ))}
        <Button kind="secondary" label={t('budget.templatesAddLine')} onPress={() => setLines((all) => [...all, emptyLine()])} />
        <Button testID="budget-templates-save" kind="secondary" label={t('budget.templatesSave')} onPress={saveTemplate} />
      </ScrollView>
    </Sheet>
  );
}
