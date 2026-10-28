import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, InlineError, Select, Sheet, Text, TextInput, useToast } from '@/design/components';
import tokens from '@/design/tokens.json';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { budgetCategories, monthLabel } from '@/features/budget/helpers';
import { t } from '@/i18n';
import { formatNaira } from '@/money';

const sp = tokens.spacing;

type LineDraft = { categoryId: string; amountText: string };

function ruleLabel(amountMinor: bigint): string {
  return t('budget.templatesRuleMonthly', { amount: formatNaira(amountMinor) });
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
  const [lines, setLines] = useState<LineDraft[]>([{ categoryId: '', amountText: '' }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cats = useMemo(() => (snapshot ? budgetCategories(snapshot) : []), [snapshot]);
  const preview = useMemo(() => {
    if (!snapshot || !selectedId) return [];
    const template = snapshot.budgetTemplates.find((t) => t.id === selectedId);
    if (!template) return [];
    return template.lines.map((line) => ({
      name: snapshot.categories.find((c) => c.id === line.categoryId)?.name ?? '',
      amount: BigInt(line.amountMinor),
      rule: ruleLabel(BigInt(line.amountMinor)),
    }));
  }, [snapshot, selectedId]);

  const saveTemplate = async () => {
    if (!snapshot) return;
    const built = lines
      .map((l) => {
        const parsed = l.amountText.replace(/,/g, '').trim();
        if (!l.categoryId || !/^\d+$/.test(parsed)) return null;
        return { categoryId: l.categoryId, amountMinor: (BigInt(parsed) * 100n).toString() };
      })
      .filter((x): x is { categoryId: string; amountMinor: string } => x !== null);
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
      footer={
        <Button
          testID="budget-templates-apply"
          label={t('budget.templatesApplyMonth', { month: monthLabel(month) })}
          onPress={apply}
          disabled={!selectedId}
        />
      }
    >
      {error ? <InlineError message={error} /> : null}
      {snapshot.budgetTemplates.length > 0 ? (
        <Select
          testID="budget-templates-pick"
          label={t('budget.templatesPick')}
          value={selectedId ?? ''}
          onChange={(id) => setSelectedId(id || null)}
          options={snapshot.budgetTemplates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
        />
      ) : null}
      {preview.length > 0 ? (
        <Card testID="budget-templates-preview" style={{ gap: sp['spacing-xs'] }}>
          <Text variant="heading-sm">{t('budget.templatesPreview')}</Text>
          {preview.map((row) => (
            <View key={row.name} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: sp['spacing-sm'] }}>
              <Text style={{ flex: 1 }}>{row.rule}</Text>
              <Text>{formatNaira(row.amount)}</Text>
            </View>
          ))}
        </Card>
      ) : null}
      <Text variant="heading-sm">{t('budget.templatesNew')}</Text>
      <TextInput testID="budget-templates-name" label={t('budget.templatesName')} value={name} onChangeText={setName} />
      {lines.map((line, i) => (
        <View key={i} style={{ gap: sp['spacing-xs'] }}>
          <Select
            label={t('budget.templatesCategory')}
            value={line.categoryId}
            onChange={(id) => setLines((all) => all.map((row, j) => (j === i ? { ...row, categoryId: id } : row)))}
            options={cats.map((c) => ({ value: c.id, label: c.name }))}
          />
          <TextInput
            label={t('budget.templatesAmount')}
            value={line.amountText}
            onChangeText={(text) => setLines((all) => all.map((row, j) => (j === i ? { ...row, amountText: text } : row)))}
            keyboardType="number-pad"
          />
        </View>
      ))}
      <Button kind="secondary" label={t('budget.templatesAddLine')} onPress={() => setLines((all) => [...all, { categoryId: '', amountText: '' }])} />
      <Button testID="budget-templates-save" kind="secondary" label={t('budget.templatesSave')} onPress={saveTemplate} />
    </Sheet>
  );
}
