import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useGlobalSearchParams, useLocalSearchParams, useRouter } from 'expo-router';

import {
  Amount,
  BarChart,
  Button,
  Card,
  EmptyState,
  formatDay,
  InlineError,
  Placeholder,
  Text,
  useToast,
} from '@/design/components';
import tokens from '@/design/tokens.json';
import { useTheme } from '@/design/ThemeProvider';
import { budgetAssignId, type Category } from '@/data/workspace/model';
import { useWorkspace } from '@/data/workspace/WorkspaceProvider';
import { AppFrame } from '@/features/frame/AppFrame';
import { ledgerMessage, rowsFor, today } from '@/features/transactions/helpers';
import { t, type TextKey } from '@/i18n';
import { formatNaira } from '@/money';
import { monthOf } from '@/ledger';

import {
  assignedOf,
  categoryActivity,
  categoryTemplateLines,
  monthsEndingAt,
  periodTotals,
  rowFor,
  shortMonth,
  sixMonthAverage,
  templateLineLabel,
} from './helpers';
import { DeleteCategorySheet, EditCategorySheet, type CategoryDraft } from './CategorySheets';

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
  const params = useGlobalSearchParams<{ category?: string }>();
  const { snapshot, repo } = useWorkspace();
  const theme = useTheme();
  const toast = useToast();
  const router = useRouter();
  const month = monthOf(today());
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = snapshot?.categories.find((c) => c.id === id);
  const editOpen = params.category === id || params.category === 'edit';

  const openEdit = () => router.setParams({ category: id });
  const closeEdit = () => router.setParams({ category: undefined });

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
    const bills = snapshot.recurring.filter((r) => r.categoryId === category.id);
    const templates = categoryTemplateLines(snapshot, category.id);
    const note = snapshot.assignNotes.get(budgetAssignId(category.id, month)) ?? '';
    return { row, avg, chartRows, txs, highlight: months.length - 1, bills, templates, note };
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

  const saveCategory = async (draft: CategoryDraft) => {
    const next: Category = {
      ...category,
      name: draft.name,
      group: draft.group,
      kind: draft.kind,
      budgetType: draft.budgetType,
      icon: draft.icon,
      essential: draft.essential,
      hidden: draft.hidden,
    };
    await repo.updateCategory(next);
    toast.show(t('category.saved'));
    closeEdit();
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
            <Button testID="category-edit" kind="secondary" label={t('category.edit')} onPress={openEdit} />
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

            <Card testID="category-connected" style={{ gap: sp['spacing-sm'] }}>
              <Text variant="heading-sm">{t('category.connected')}</Text>
              {model.bills.length === 0 && model.templates.length === 0 && !model.note ? (
                <Text tone="textSecondary">{t('category.connectedEmpty')}</Text>
              ) : null}
              {model.bills.map((bill) => (
                <Pressable
                  key={bill.id}
                  testID={`category-bill-${bill.id}`}
                  accessibilityRole="button"
                  onPress={() => router.push('/plan')}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text>{t('category.connectedBill', { name: bill.name })}</Text>
                </Pressable>
              ))}
              {model.templates.map(({ templateName, line }) => (
                <Pressable
                  key={`${templateName}-${line.categoryId}`}
                  testID="category-template-row"
                  accessibilityRole="button"
                  onPress={() => router.push('/budget')}
                  style={{ minHeight: 44, justifyContent: 'center' }}
                >
                  <Text>{t('category.connectedTemplate', { name: templateName, rule: templateLineLabel(snapshot, line) })}</Text>
                </Pressable>
              ))}
              {model.note ? (
                <View testID="category-plan-note">
                  <Text variant="caption" tone="textSecondary">
                    {t('category.planNote')}
                  </Text>
                  <Text>{model.note}</Text>
                </View>
              ) : null}
            </Card>
          </>
        )}
      </ScrollView>

      <EditCategorySheet
        visible={editOpen}
        category={category}
        snapshot={snapshot}
        onClose={closeEdit}
        onSave={saveCategory}
        onDelete={() => {
          closeEdit();
          setDeleteOpen(true);
        }}
      />

      {deleteOpen ? (
        <DeleteCategorySheet
          visible
          category={category}
          snapshot={snapshot}
          month={month}
          onClose={() => setDeleteOpen(false)}
          onConfirm={async (moveTo) => {
            setError(null);
            const r = await repo.deleteCategory(category.id, moveTo, today());
            if (!r.ok) {
              setError(ledgerMessage(r.error));
              return;
            }
            const undoId = r.value?.undoId;
            toast.show(t('category.deleted'), undoId ? () => void repo.undoDeleteCategory(undoId, today()) : undefined);
            router.replace('/budget');
          }}
        />
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
