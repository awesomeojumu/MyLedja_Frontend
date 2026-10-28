import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import {
  Amount,
  BarChart,
  Button,
  Card,
  EmptyState,
  formatDay,
  InlineError,
  Placeholder,
  Select,
  Sheet,
  Switch,
  Text,
  TextInput,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { BUDGET_TYPES, type BudgetType, type Category } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, rowsFor, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import {
  assignedOf,
  categoryActivity,
  monthsEndingAt,
  periodTotals,
  rowFor,
  shortMonth,
  sixMonthAverage,
} from './helpers';

const sp = tokens.spacing;

const GROUP_OPTIONS: { value: string; labelKey: TextKey }[] = [
  { value: 'group.home', labelKey: 'group.home' },
  { value: 'group.gettingAround', labelKey: 'group.gettingAround' },
  { value: 'group.food', labelKey: 'group.food' },
  { value: 'group.family', labelKey: 'group.family' },
  { value: 'group.faith', labelKey: 'group.faith' },
  { value: 'group.income', labelKey: 'group.income' },
];

export function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { snapshot, repo } = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const month = monthOf(today());
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [moveTo, setMoveTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const category = snapshot?.categories.find((c) => c.id === id);

  const model = useMemo(() => {
    if (!snapshot || !category) return null;
    const row = rowFor(snapshot, month, category.id);
    const avg = sixMonthAverage(snapshot, category.id, month);
    const months = monthsEndingAt(month, 12);
    const totals = periodTotals(snapshot.events);
    const chartRows = months.map((m) => {
      const planned = assignedOf(snapshot, category.id, m);
      const spent = categoryActivity(totals, m, category.id);
      return {
        label: shortMonth(m),
        value: spent,
        planned,
        over: spent > planned && planned > 0n,
      };
    });
    const txs = rowsFor(snapshot).filter(
      (r) =>
        monthOf(r.event.date) === month &&
        r.event.lines.some((l) => l.ledgerAccountId === category.id) &&
        r.event.type !== 'transfer' &&
        r.event.type !== 'opening_balance',
    );
    return { row, avg, chartRows, txs, highlight: months.length - 1 };
  }, [snapshot, category, month]);

  if (!snapshot) {
    return (
      <AppFrame title={t('category.title')}>
        <Placeholder height={120} />
      </AppFrame>
    );
  }

  if (!category) {
    return (
      <AppFrame title={t('category.title')}>
        <EmptyState title={t('category.missingTitle')} body={t('category.missingBody')} actionLabel={t('budget.title')} onAction={() => router.replace('/budget')} />
      </AppFrame>
    );
  }

  const groupLabel = (group: string) => {
    const known = GROUP_OPTIONS.find((g) => g.value === group);
    return known ? t(known.labelKey) : group;
  };

  return (
    <AppFrame title={category.name}>
      <ScrollView contentContainerStyle={{ gap: sp['spacing-lg'] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: sp['spacing-md'], flexWrap: 'wrap' }}>
          <View style={{ gap: sp['spacing-xxs'] }}>
            <Text variant="caption" tone="textSecondary">
              {groupLabel(category.group)}
            </Text>
            <Text testID="category-type" variant="caption" tone="textSecondary">
              {t(`category.budgetType.${category.budgetType}`)}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: sp['spacing-sm'] }}>
            <Button testID="category-edit" kind="secondary" label={t('category.edit')} onPress={() => setEditOpen(true)} />
            <Button testID="category-back" kind="secondary" label={t('common.back')} onPress={() => router.push('/budget')} />
          </View>
        </View>

        {error ? <InlineError message={error} /> : null}

        {!model ? (
          <Placeholder height={80} />
        ) : (
          <>
            <View testID="category-stats" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp['spacing-md'] }}>
              <Stat label={t('budget.col.planned')} minor={model.row.assigned} testID="category-planned" />
              <Stat label={t('budget.col.spent')} minor={model.row.activity} testID="category-spent" />
              <Stat label={t('budget.col.remaining')} minor={model.row.available} testID="category-remaining" />
              <Stat label={t('category.sixMonthAvg')} minor={model.avg} testID="category-avg" />
            </View>

            <Card>
              <BarChart
                testID="category-chart"
                title={t('category.chartTitle', { name: category.name })}
                columns={[t('category.chartMonth'), t('category.chartSpent')]}
                rows={model.chartRows}
                highlight={model.highlight}
              />
              <Text variant="caption" tone="textSecondary" style={{ marginTop: sp['spacing-sm'] }}>
                {t('category.chartPlannedHint', { amount: formatNaira(model.row.assigned) })}
              </Text>
            </Card>

            <Card testID="category-transactions" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('category.thisMonth')}</Text>
              {model.txs.length === 0 ? (
                <Text tone="textSecondary">{t('category.noTx')}</Text>
              ) : (
                model.txs.slice(0, 8).map((row) => (
                  <Pressable
                    key={row.event.id}
                    testID={`category-tx-${row.event.id}`}
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/transactions', params: { tx: row.event.id } })}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      minHeight: 44,
                      alignItems: 'center',
                      borderTopWidth: 1,
                      borderTopColor: theme.border,
                      paddingVertical: sp['spacing-sm'],
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text>{row.title}</Text>
                      <Text variant="caption" tone="textSecondary">
                        {formatDay(row.event.date)}
                      </Text>
                    </View>
                    <Amount minor={row.amount} />
                  </Pressable>
                ))
              )}
              <Button
                testID="category-see-all"
                kind="link"
                label={t('category.seeAll')}
                onPress={() => router.push({ pathname: '/transactions', params: { category: category.id, month } })}
              />
            </Card>
          </>
        )}
      </ScrollView>

      {editOpen ? (
        <EditCategorySheet
          category={category}
          onClose={() => setEditOpen(false)}
          onSave={async (next) => {
            await repo.updateCategory(next);
            toast.show(t('common.saved'));
            setEditOpen(false);
          }}
          onDelete={() => {
            setEditOpen(false);
            setMoveTo(snapshot.categories.find((c) => c.id !== category.id && c.kind === category.kind)?.id ?? '');
            setDeleteOpen(true);
          }}
        />
      ) : null}

      {deleteOpen ? (
        <Sheet
          visible
          title={t('category.deleteTitle')}
          onClose={() => setDeleteOpen(false)}
          testID="category-delete-sheet"
          footer={
            <Button
              testID="category-delete-confirm"
              label={t('category.deleteConfirm')}
              disabled={!moveTo}
              onPress={async () => {
                setError(null);
                const r = await repo.deleteCategory(category.id, moveTo, today());
                if (!r.ok) {
                  setError(ledgerMessage(r.error));
                  return;
                }
                toast.show(t('category.deleted'));
                router.replace('/budget');
              }}
            />
          }
        >
          <Text>{t('category.deleteBody')}</Text>
          <Select
            testID="category-delete-move"
            label={t('category.deleteMove')}
            options={snapshot.categories
              .filter((c) => c.id !== category.id && c.kind === category.kind)
              .map((c) => ({ value: c.id, label: c.name }))}
            value={moveTo}
            onChange={setMoveTo}
          />
        </Sheet>
      ) : null}
    </AppFrame>
  );
}

function Stat({ label, minor, testID }: { label: string; minor: bigint; testID: string }) {
  return (
    <View testID={testID} style={{ minWidth: '45%', flexGrow: 1, gap: 2 }}>
      <Text variant="caption" tone="textSecondary">
        {label}
      </Text>
      <Amount minor={minor} variant="heading-sm" />
    </View>
  );
}

function EditCategorySheet({
  category,
  onClose,
  onSave,
  onDelete,
}: {
  category: Category;
  onClose: () => void;
  onSave: (c: Category) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [group, setGroup] = useState(category.group);
  const [budgetType, setBudgetType] = useState<BudgetType>(category.budgetType);
  const [hidden, setHidden] = useState(category.hidden);
  const groupOptions = GROUP_OPTIONS.map((g) => ({ value: g.value, label: t(g.labelKey) }));
  if (!groupOptions.some((g) => g.value === group)) {
    groupOptions.push({ value: group, label: group });
  }

  return (
    <Sheet
      visible
      title={t('category.edit')}
      onClose={onClose}
      testID="category-edit-sheet"
      footer={
        <View style={{ gap: sp['spacing-sm'] }}>
          <Button
            testID="category-edit-save"
            label={t('budget.save')}
            disabled={!name.trim()}
            onPress={() => void onSave({ ...category, name: name.trim(), group, budgetType, hidden })}
          />
          <Button testID="category-edit-delete" kind="secondary" label={t('category.delete')} onPress={onDelete} />
        </View>
      }
    >
      <TextInput testID="category-edit-name" label={t('category.name')} value={name} onChangeText={setName} />
      <Select testID="category-edit-group" label={t('category.group')} options={groupOptions} value={group} onChange={setGroup} />
      <Select
        testID="category-edit-type"
        label={t('category.type')}
        options={BUDGET_TYPES.map((v) => ({ value: v, label: t(`category.budgetType.${v}`) }))}
        value={budgetType}
        onChange={(v) => setBudgetType(v as BudgetType)}
      />
      <Switch testID="category-edit-hide" label={t('category.hideFromBudget')} value={hidden} onChange={setHidden} />
    </Sheet>
  );
}
